import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes as utf8 } from "@noble/hashes/utils.js";
import {
  AccountRole,
  type Address,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";

// Client for programs/hyphae: PDAs, instruction bytes and account layouts, shared by the publish
// job and the claim page. The bytes are pinned by the shared H-CONTRACT vectors, which the Rust
// tests assert against the program itself.
export const HYPHAE_PROGRAM_ID = address("EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E");
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

const discriminator = (preimage: string) => sha256(utf8(preimage)).slice(0, 8);
const addressBytes = (a: Address) => new Uint8Array(getAddressEncoder().encode(a));

const MAX_U64 = (1n << 64n) - 1n;
function u64(v: bigint): Uint8Array {
  if (v < 0n || v > MAX_U64) throw new RangeError(`program: ${v} is not a u64`);
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, v, true);
  return out;
}
function bytes32(b: Uint8Array, what: string): Uint8Array {
  if (b.length !== 32) throw new RangeError(`program: ${what} must be 32 bytes`);
  return b;
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function pda(programId: Address, seeds: Uint8Array[]): Promise<Address> {
  const [found] = await getProgramDerivedAddress({ programAddress: programId, seeds });
  return found;
}
export const communityAddress = (programId: Address, mint: Address, admin: Address) =>
  pda(programId, [utf8("community"), addressBytes(mint), addressBytes(admin)]);
export const vaultAddress = (programId: Address, community: Address) =>
  pda(programId, [utf8("vault"), addressBytes(community)]);
export const epochAddress = (programId: Address, community: Address, index: bigint) =>
  pda(programId, [utf8("epoch"), addressBytes(community), u64(index)]);
export const receiptAddress = (programId: Address, epoch: Address, wallet: Address) =>
  pda(programId, [utf8("claim"), addressBytes(epoch), addressBytes(wallet)]);

const signerMeta = (signer: TransactionSigner) => ({
  address: signer.address,
  role: AccountRole.WRITABLE_SIGNER,
  signer,
});
const writable = (a: Address) => ({ address: a, role: AccountRole.WRITABLE });
const readonly = (a: Address) => ({ address: a, role: AccountRole.READONLY });

type PublishEpochArgs = {
  index: bigint;
  root: Uint8Array;
  auditHash: Uint8Array;
  grossLamports: bigint;
  allocatedLamports: bigint;
};
const publishEpochData = (a: PublishEpochArgs) =>
  concat(
    discriminator("global:publish_epoch"),
    u64(a.index),
    bytes32(a.root, "root"),
    bytes32(a.auditHash, "audit hash"),
    u64(a.grossLamports),
    u64(a.allocatedLamports),
  );

type ClaimArgs = { score: bigint; amount: bigint; evidenceHash: Uint8Array };
// A claim's data before its proof.
const claimHead = (a: ClaimArgs) =>
  concat(
    discriminator("global:claim"),
    u64(a.score),
    u64(a.amount),
    bytes32(a.evidenceHash, "evidence hash"),
  );

export function initializeCommunityInstruction(input: {
  programId: Address;
  admin: TransactionSigner;
  mint: Address;
  community: Address;
  vault: Address;
  feeRecipient: Uint8Array;
}): Instruction {
  return {
    programAddress: input.programId,
    accounts: [
      signerMeta(input.admin),
      readonly(input.mint),
      writable(input.community),
      writable(input.vault),
      readonly(SYSTEM_PROGRAM),
    ],
    data: concat(
      discriminator("global:initialize_community"),
      bytes32(input.feeRecipient, "fee recipient"),
    ),
  };
}

export function publishEpochInstruction(input: {
  programId: Address;
  admin: TransactionSigner;
  community: Address;
  vault: Address;
  feeRecipient: Address;
  epoch: Address;
  index: bigint;
  root: Uint8Array;
  auditHash: Uint8Array;
  grossLamports: bigint;
  allocatedLamports: bigint;
}): Instruction {
  return {
    programAddress: input.programId,
    accounts: [
      signerMeta(input.admin),
      writable(input.community),
      writable(input.vault),
      writable(input.feeRecipient),
      writable(input.epoch),
      readonly(SYSTEM_PROGRAM),
    ],
    data: publishEpochData(input),
  };
}

export function claimInstruction(input: {
  programId: Address;
  claimant: TransactionSigner;
  community: Address;
  vault: Address;
  epoch: Address;
  receipt: Address;
  score: bigint;
  amount: bigint;
  evidenceHash: Uint8Array;
  proof: Uint8Array[];
}): Instruction {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, input.proof.length, true);
  return {
    programAddress: input.programId,
    accounts: [
      signerMeta(input.claimant),
      writable(input.community),
      writable(input.vault),
      writable(input.epoch),
      writable(input.receipt),
      readonly(SYSTEM_PROGRAM),
    ],
    data: concat(claimHead(input), length, ...input.proof.map((p) => bytes32(p, "proof node"))),
  };
}

// An instruction as a confirmed transaction lists it, top-level or inner: its program, its
// accounts in order, and its data.
export interface ListedInstruction {
  program: string;
  accounts: readonly string[];
  data: Uint8Array;
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// The publish_epoch that created `epoch` with exactly these commitments and amounts. Only one
// can succeed per epoch account, so a successful transaction carrying it is the publication.
export function isPublishEpoch(
  ix: ListedInstruction,
  e: PublishEpochArgs & {
    programId: Address;
    community: Address;
    vault: Address;
    feeRecipient: Address;
    epoch: Address;
  },
): boolean {
  const [, community, vault, feeRecipient, epoch] = ix.accounts;
  return (
    ix.program === e.programId &&
    community === e.community &&
    vault === e.vault &&
    feeRecipient === e.feeRecipient &&
    epoch === e.epoch &&
    sameBytes(ix.data, publishEpochData(e))
  );
}

// The claim that created `receipt` for this claimant and leaf. The proof is not compared: the
// program verified it against the root, and only one claim per receipt can succeed.
export function isClaim(
  ix: ListedInstruction,
  c: ClaimArgs & {
    programId: Address;
    claimant: Address;
    community: Address;
    vault: Address;
    epoch: Address;
    receipt: Address;
  },
): boolean {
  const [claimant, community, vault, epoch, receipt] = ix.accounts;
  const head = claimHead(c);
  return (
    ix.program === c.programId &&
    claimant === c.claimant &&
    community === c.community &&
    vault === c.vault &&
    epoch === c.epoch &&
    receipt === c.receipt &&
    sameBytes(ix.data.slice(0, head.length), head)
  );
}

// Account layouts: an 8-byte discriminator, then Borsh fields in declaration order.
class Reader {
  private at = 8;
  private readonly view: DataView;
  constructor(
    private readonly data: Uint8Array,
    name: string,
    length: number,
  ) {
    const expected = discriminator(`account:${name}`);
    if (!expected.every((b, i) => data[i] === b)) {
      throw new Error(`program: not a ${name} account (discriminator)`);
    }
    if (data.length !== length) throw new Error(`program: ${name} has length ${data.length}`);
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  bytes32() {
    const out = this.data.slice(this.at, this.at + 32);
    this.at += 32;
    return out;
  }
  u64() {
    const v = this.view.getBigUint64(this.at, true);
    this.at += 8;
    return v;
  }
  i64() {
    const v = this.view.getBigInt64(this.at, true);
    this.at += 8;
    return v;
  }
  u8() {
    const v = this.view.getUint8(this.at);
    this.at += 1;
    return v;
  }
}

export function decodeCommunity(data: Uint8Array) {
  const r = new Reader(data, "Community", 8 + 32 * 3 + 8 + 2);
  return {
    mint: r.bytes32(),
    admin: r.bytes32(),
    feeRecipient: r.bytes32(),
    outstandingLamports: r.u64(),
    bump: r.u8(),
    vaultBump: r.u8(),
  };
}

export function decodeEpoch(data: Uint8Array) {
  const r = new Reader(data, "Epoch", 8 + 32 + 8 + 32 + 32 + 8 * 4 + 8 + 1);
  return {
    community: r.bytes32(),
    index: r.u64(),
    root: r.bytes32(),
    auditHash: r.bytes32(),
    grossLamports: r.u64(),
    feeLamports: r.u64(),
    allocatedLamports: r.u64(),
    claimedLamports: r.u64(),
    publishedAt: r.i64(),
    bump: r.u8(),
  };
}

export function decodeClaimReceipt(data: Uint8Array) {
  const r = new Reader(data, "ClaimReceipt", 8 + 32 + 32 + 8 + 8 + 32 + 8 + 1);
  return {
    epoch: r.bytes32(),
    wallet: r.bytes32(),
    score: r.u64(),
    amount: r.u64(),
    evidenceHash: r.bytes32(),
    claimedAt: r.i64(),
    bump: r.u8(),
  };
}
