import {
  type AllocationV1,
  type ClaimV1,
  decodeClaimReceipt,
  decodeEpoch,
  epochAddress,
  type PaymentV1,
  receiptAddress,
  vaultAddress,
} from "@hyphae/core";
import { bytesToHex } from "@noble/hashes/utils.js";
import { type Address, address, getAddressDecoder } from "@solana/kit";
import type { PublicationIntent } from "../payout/intent.js";

// P13/P14: allocation and payment are read against the chain, never from a database string. The
// stored publication intent says what was published; the epoch account and the claim receipts say
// it is so. Anything the chain cannot confirm is `unavailable` with a reason, never zero.

export interface SettlementReader {
  // The cluster the reader serves, proven by its genesis hash.
  network(): Promise<"solana:devnet" | "solana:mainnet">;
  // The accounts at `at`, in order, null where none exists; any owner but `owner` throws.
  accounts(owner: string, at: readonly string[]): Promise<(Uint8Array | null)[]>;
  // The first successful transaction that touched `at`: for a receipt, the claim that made it.
  firstSignature(at: string): Promise<string | null>;
  latestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: bigint }>;
}

type Unavailable = { status: "unavailable"; reason: string };
const unavailable = (reason: string): Unavailable => ({ status: "unavailable", reason });

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

// The stored intent, confirmed by the epoch account it was published to.
export async function verifyPublication(
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
  let data: Uint8Array | null | undefined;
  try {
    if ((await reader.network()) !== intent.audit.network) return unavailable("chain_unconfigured");
    [data] = await reader.accounts(program, [epoch]);
  } catch {
    return unavailable("chain_unavailable");
  }
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
  return {
    intent,
    program,
    community,
    vault: await vaultAddress(program, community),
    epoch,
    claimed: e.claimedLamports,
    publishTx: facts.publishTx,
    publishedAt: facts.publishedAt,
  };
}

// An account of the wrong type or length is not the account the publication names.
function decoded<T>(decode: (data: Uint8Array) => T, data: Uint8Array): T | null {
  try {
    return decode(data);
  } catch {
    return null;
  }
}

export function allocationOf(v: Verified | Unavailable): AllocationV1 {
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

// Each leaf's receipt: paid only if the account exists, matches the leaf, and its transaction is
// found. The receipts must explain the epoch account's claimed total exactly.
async function receiptsOf(v: Verified, reader: SettlementReader, leaves: readonly Leaf[]) {
  const receipts = await Promise.all(
    leaves.map((l) => receiptAddress(v.program, v.epoch, address(l.wallet))),
  );
  const data = await reader.accounts(v.program, receipts);
  const out: Receipted[] = [];
  for (const [i, leaf] of leaves.entries()) {
    const receipt = receipts[i] as Address;
    const account = data[i];
    if (!account) {
      out.push({ leaf, receipt, claimTx: null });
      continue;
    }
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
    const claimTx = await reader.firstSignature(receipt);
    if (!claimTx) throw new Error("settlement: a receipt without its transaction");
    out.push({ leaf, receipt, claimTx });
  }
  return out;
}

export async function paymentOf(
  v: Verified | Unavailable,
  reader: SettlementReader | undefined,
): Promise<PaymentV1> {
  if ("status" in v) return v;
  if (!reader) return unavailable("chain_unconfigured");
  try {
    const rows = await receiptsOf(v, reader, v.intent.leaves);
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
    return unavailable(error instanceof Mismatch ? "chain_mismatch" : "chain_unavailable");
  }
}

// One wallet's leaf, or null when the epoch has no recorded publication or the wallet no leaf.
// The leaf is served even when the chain cannot be read; its payment status then says so.
export async function claimOf(
  facts: PublicationFacts,
  reader: SettlementReader | undefined,
  wallet: string,
): Promise<Omit<ClaimV1, "community" | "as_of"> | null> {
  const { intent } = facts;
  if (!intent || !facts.publishTx) return null;
  if (facts.firstPaidEpoch !== null && facts.index < facts.firstPaidEpoch) return null;
  const leaf = intent.leaves.find((l) => l.wallet === wallet);
  if (!leaf) return null;
  const program = address(intent.audit.program_id);
  const community = address(intent.communityAddress);
  const epoch = await epochAddress(program, community, BigInt(facts.index));
  const verified = await verifyPublication(facts, reader);
  let payment: ClaimV1["payment"];
  if ("status" in verified || !reader) {
    payment = "status" in verified ? verified : unavailable("chain_unconfigured");
  } else {
    try {
      const [row] = await receiptsOf(verified, reader, [leaf]);
      if (row?.claimTx) {
        payment = { status: "paid", claim_tx: row.claimTx };
      } else {
        const { blockhash, lastValidBlockHeight } = await reader.latestBlockhash();
        payment = {
          status: "claimable",
          recent_blockhash: blockhash,
          last_valid_block_height: lastValidBlockHeight.toString(),
        };
      }
    } catch (error) {
      payment = unavailable(error instanceof Mismatch ? "chain_mismatch" : "chain_unavailable");
    }
  }
  return {
    epoch: { index: facts.index },
    wallet,
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
    payment,
  };
}
