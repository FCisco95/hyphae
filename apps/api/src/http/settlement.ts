import {
  type AllocationV1,
  type ClaimV1,
  decodeClaimReceipt,
  decodeEpoch,
  epochAddress,
  isClaim,
  isPublishEpoch,
  type ListedInstruction,
  type PaymentV1,
  receiptAddress,
  vaultAddress,
  type WalletClaimV1,
} from "@hyphae/core";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { type Address, address, getAddressDecoder } from "@solana/kit";
import type { PublicationIntent } from "../payout/intent.js";

// P13/P14: allocation and payment are read against the chain, never from a database string. The
// stored publication intent says what was published; the epoch account and the claim receipts say
// it is so, and each transaction shown is the one the chain shows creating them. Anything the
// chain cannot confirm is `unavailable` with a reason, never zero.

export interface SettlementReader {
  // The cluster the reader serves, proven by its genesis hash.
  network(): Promise<"solana:devnet" | "solana:mainnet">;
  // The accounts at `at`, in order, null where none exists; any owner but `owner` throws.
  accounts(owner: string, at: readonly string[]): Promise<(Uint8Array | null)[]>;
  // The successful transaction that created the program account `at` through an instruction
  // `matches` accepts, or null when none is found within the reader's bounds. The hint (a
  // recorded signature, the second the account records as its creation) is tried first.
  creation(
    at: string,
    matches: (ix: ListedInstruction) => boolean,
    hint?: { signature?: string | null; blockTime?: bigint },
  ): Promise<string | null>;
  latestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: bigint }>;
}

// The chain is read after the database, under one deadline, because the web client gives up at
// 3 s. Work still running then is abandoned, not cancelled; what it finds warms the reader's cache.
export const CHAIN_DEADLINE_MS = 2_000;
export const LOOKUPS_AT_ONCE = 8;

type Unavailable = { status: "unavailable"; reason: string };
const unavailable = (reason: string): Unavailable => ({ status: "unavailable", reason });
const late = unavailable("chain_unavailable");

// What the database knows about an epoch's publication, read inside the read-only snapshot.
export interface PublicationFacts {
  index: number;
  firstPaidEpoch: number | null;
  publishTx: string | null;
  publishedAt: string | null;
  intent: PublicationIntent | null;
}

interface Verified {
  intent: PublicationIntent;
  program: Address;
  community: Address;
  vault: Address;
  epoch: Address;
  claimed: bigint;
  publishTx: string;
  publishedAt: string;
}

class Mismatch extends Error {}
// An account the chain holds without the transaction that created it, within the reader's bounds.
class NoTransaction extends Error {}

const failure = (error: unknown) =>
  unavailable(
    error instanceof Mismatch
      ? "chain_mismatch"
      : error instanceof NoTransaction
        ? "chain_transaction_missing"
        : "chain_unavailable",
  );

// `work`, or `fallback` once `until` (epoch ms) passes. `work` must not reject.
function byDeadline<T>(work: Promise<T>, until: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), Math.max(0, until - Date.now()));
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// `fn` over `items`, at most `limit` at a time, results in order.
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// The stored intent, confirmed by the epoch account it was published to and the publish_epoch
// that created that account.
async function verifyPublication(
  facts: PublicationFacts,
  reader: SettlementReader | undefined,
): Promise<Verified | Unavailable> {
  if (facts.firstPaidEpoch !== null && facts.index < facts.firstPaidEpoch) {
    return unavailable("before_first_paid_epoch");
  }
  if (!facts.publishTx || !facts.publishedAt) return unavailable("no_settlement");
  if (!facts.intent) return unavailable("no_stored_intent");
  if (!reader) return unavailable("chain_unconfigured");
  const { intent } = facts;
  const s = intent.audit.settlement;
  const program = address(intent.audit.program_id);
  const community = address(intent.communityAddress);
  const epoch = await epochAddress(program, community, BigInt(facts.index));
  const vault = await vaultAddress(program, community);
  try {
    if ((await reader.network()) !== intent.audit.network) return unavailable("chain_unconfigured");
    const [data] = await reader.accounts(program, [epoch]);
    const e = data ? decoded(decodeEpoch, data) : null;
    if (
      !e ||
      getAddressDecoder().decode(e.community) !== community ||
      e.index !== BigInt(facts.index) ||
      bytesToHex(e.root) !== intent.root ||
      bytesToHex(e.auditHash) !== intent.auditHash ||
      e.grossLamports !== BigInt(s.gross_lamports) ||
      e.feeLamports !== BigInt(s.fee_lamports) ||
      e.allocatedLamports !== BigInt(s.allocated_lamports)
    ) {
      return unavailable("chain_mismatch");
    }
    const publishTx = await reader.creation(
      epoch,
      (ix) =>
        isPublishEpoch(ix, {
          programId: program,
          community,
          vault,
          feeRecipient: address(s.fee_recipient),
          epoch,
          index: BigInt(facts.index),
          root: hexToBytes(intent.root),
          auditHash: hexToBytes(intent.auditHash),
          grossLamports: BigInt(s.gross_lamports),
          allocatedLamports: BigInt(s.allocated_lamports),
        }),
      { signature: facts.publishTx, blockTime: e.publishedAt },
    );
    if (!publishTx) return unavailable("chain_transaction_missing");
    return {
      intent,
      program,
      community,
      vault,
      epoch,
      claimed: e.claimedLamports,
      publishTx,
      publishedAt: facts.publishedAt,
    };
  } catch (error) {
    return failure(error);
  }
}

// An account of the wrong type or length is not the account the publication names.
function decoded<T>(decode: (data: Uint8Array) => T, data: Uint8Array): T | null {
  try {
    return decode(data);
  } catch {
    return null;
  }
}

function allocationOf(v: Verified | Unavailable): AllocationV1 {
  if ("status" in v) return v;
  const { audit } = v.intent;
  const s = audit.settlement;
  return {
    status: "published",
    network: audit.network,
    program_id: v.program,
    community_address: v.community,
    vault_address: v.vault,
    epoch_address: v.epoch,
    publish_tx: v.publishTx,
    published_at: v.publishedAt,
    root: v.intent.root,
    audit_hash: v.intent.auditHash,
    gross_lamports: s.gross_lamports,
    fee_bps: s.fee_bps,
    fee_lamports: s.fee_lamports,
    fee_recipient: s.fee_recipient,
    net_lamports: s.net_lamports,
    allocated_lamports: s.allocated_lamports,
    cap_remainder_lamports: s.cap_remainder_lamports,
    dust_lamports: s.dust_lamports,
    payable_members: s.payable_members,
  };
}

type Leaf = PublicationIntent["leaves"][number];
type Receipted = { leaf: Leaf; receipt: Address; claimTx: string | null };

// Each leaf's receipt: paid only if the account exists, matches the leaf, and the claim that
// created it is found. Throws Mismatch or NoTransaction otherwise.
async function receiptsOf(v: Verified, reader: SettlementReader, leaves: readonly Leaf[]) {
  const receipts = await Promise.all(
    leaves.map((l) => receiptAddress(v.program, v.epoch, address(l.wallet))),
  );
  const data = await reader.accounts(v.program, receipts);
  return mapLimit(
    leaves.map((leaf, i) => ({ leaf, receipt: receipts[i] as Address, account: data[i] })),
    LOOKUPS_AT_ONCE,
    async ({ leaf, receipt, account }): Promise<Receipted> => {
      if (!account) return { leaf, receipt, claimTx: null };
      const r = decoded(decodeClaimReceipt, account);
      if (
        !r ||
        getAddressDecoder().decode(r.epoch) !== v.epoch ||
        getAddressDecoder().decode(r.wallet) !== leaf.wallet ||
        r.amount !== leaf.amountLamports ||
        r.score !== leaf.score ||
        bytesToHex(r.evidenceHash) !== leaf.evidenceHash
      ) {
        throw new Mismatch();
      }
      const claimTx = await reader.creation(
        receipt,
        (ix) =>
          isClaim(ix, {
            programId: v.program,
            claimant: address(leaf.wallet),
            community: v.community,
            vault: v.vault,
            epoch: v.epoch,
            receipt,
            score: leaf.score,
            amount: leaf.amountLamports,
            evidenceHash: hexToBytes(leaf.evidenceHash),
          }),
        { blockTime: r.claimedAt },
      );
      if (!claimTx) throw new NoTransaction();
      return { leaf, receipt, claimTx };
    },
  );
}

async function paymentOf(
  v: Verified | Unavailable,
  reader: SettlementReader | undefined,
): Promise<PaymentV1> {
  if ("status" in v) return v;
  if (!reader) return unavailable("chain_unconfigured");
  try {
    const rows = await receiptsOf(v, reader, v.intent.leaves);
    // The receipts must explain the epoch account's claimed total exactly.
    const paid = rows.reduce((sum, r) => sum + (r.claimTx ? r.leaf.amountLamports : 0n), 0n);
    if (paid !== v.claimed) return unavailable("chain_mismatch");
    const allocated = BigInt(v.intent.audit.settlement.allocated_lamports);
    return {
      status: "available",
      claimed_lamports: v.claimed.toString(),
      unclaimed_lamports: (allocated - v.claimed).toString(),
      claims: rows
        .map((r) => ({
          member_id: r.leaf.memberId,
          wallet: r.leaf.wallet,
          amount_lamports: r.leaf.amountLamports.toString(),
          status: r.claimTx ? ("paid" as const) : ("claimable" as const),
          receipt_address: r.receipt,
          claim_tx: r.claimTx,
        }))
        .sort((a, b) => (a.member_id < b.member_id ? -1 : 1)),
    };
  } catch (error) {
    return failure(error);
  }
}

// The epoch's P14 sections, each unavailable once the deadline passes. The allocation is read
// first, so slow payment lookups never hide a verified publication.
export async function settlementOf(
  facts: PublicationFacts,
  reader: SettlementReader | undefined,
  deadlineMs = CHAIN_DEADLINE_MS,
): Promise<{ allocation: AllocationV1; payment: PaymentV1 }> {
  const until = Date.now() + deadlineMs;
  const verified = await byDeadline(verifyPublication(facts, reader), until, late);
  return {
    allocation: allocationOf(verified),
    payment: await byDeadline(paymentOf(verified, reader), until, late),
  };
}

// A4: v1's first `allocation` and `payment` fields stay a closed `unavailable`; once `settlement`
// holds more, they point there.
export const firstV1Section = (section: AllocationV1 | PaymentV1): Unavailable =>
  section.status === "unavailable" ? section : unavailable("see_settlement");

// A wallet's leaf in a recorded publication, with every address a claim needs; null when the
// epoch has no recorded publication or the wallet no leaf in it.
async function leafOf(facts: PublicationFacts, wallet: string) {
  const { intent } = facts;
  if (!intent || !facts.publishTx) return null;
  if (facts.firstPaidEpoch !== null && facts.index < facts.firstPaidEpoch) return null;
  const leaf = intent.leaves.find((l) => l.wallet === wallet);
  if (!leaf) return null;
  const program = address(intent.audit.program_id);
  const community = address(intent.communityAddress);
  const epoch = await epochAddress(program, community, BigInt(facts.index));
  return {
    leaf,
    fields: {
      network: intent.audit.network,
      program_id: program,
      community_address: community,
      vault_address: await vaultAddress(program, community),
      epoch_address: epoch,
      receipt_address: await receiptAddress(program, epoch, address(wallet)),
      score: leaf.score.toString(),
      amount_lamports: leaf.amountLamports.toString(),
      evidence_hash: leaf.evidenceHash,
      proof: leaf.proof,
      root: intent.root,
    },
  };
}

// Only this leaf's receipt is read, so one claim never waits on other members' payments.
async function leafPayment(
  facts: PublicationFacts,
  reader: SettlementReader | undefined,
  leaf: Leaf,
): Promise<WalletClaimV1["payment"]> {
  const verified = await verifyPublication(facts, reader);
  if ("status" in verified) return verified;
  if (!reader) return unavailable("chain_unconfigured");
  try {
    const [row] = await receiptsOf(verified, reader, [leaf]);
    return row?.claimTx ? { status: "paid", claim_tx: row.claimTx } : { status: "claimable" };
  } catch (error) {
    return failure(error);
  }
}

// One wallet's leaf, with a fresh blockhash when it is claimable. The leaf is served even when
// the chain cannot be read; its payment status then says so.
export async function claimOf(
  facts: PublicationFacts,
  reader: SettlementReader | undefined,
  wallet: string,
  deadlineMs = CHAIN_DEADLINE_MS,
): Promise<Omit<ClaimV1, "community" | "as_of"> | null> {
  const found = await leafOf(facts, wallet);
  if (!found) return null;
  const paymentFor = async (): Promise<ClaimV1["payment"]> => {
    const payment = await leafPayment(facts, reader, found.leaf);
    if (payment.status !== "claimable") return payment;
    if (!reader) return unavailable("chain_unconfigured");
    try {
      const { blockhash, lastValidBlockHeight } = await reader.latestBlockhash();
      return {
        status: "claimable",
        recent_blockhash: blockhash,
        last_valid_block_height: lastValidBlockHeight.toString(),
      };
    } catch (error) {
      return failure(error);
    }
  };
  return {
    epoch: { index: facts.index },
    wallet,
    ...found.fields,
    payment: await byDeadline(paymentFor(), Date.now() + deadlineMs, late),
  };
}

// The same leaf for a wallet's list of claims, whose one deadline `until` (epoch ms) every entry
// shares.
export async function walletClaimOf(
  facts: PublicationFacts,
  reader: SettlementReader | undefined,
  wallet: string,
  until: number,
): Promise<Omit<WalletClaimV1, "community"> | null> {
  const found = await leafOf(facts, wallet);
  if (!found) return null;
  return {
    epoch: { index: facts.index },
    ...found.fields,
    payment: await byDeadline(leafPayment(facts, reader, found.leaf), until, late),
  };
}
