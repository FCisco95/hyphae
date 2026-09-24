import { createPrivateKey, createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { buildTree, encodeLeaf, getProof, type Leaf, leafHash, verifyProof } from "./merkle.js";

// The shared H-CONTRACT vectors (B10). This test computes every vector from fixed inputs and
// compares the result with the committed file; the Rust tests in programs/hyphae and
// tests/h_contract_vectors.py read the same file. Regenerating it (UPDATE_VECTORS=1) is a
// reviewed change.
const FILE = new URL("./test-vectors/h-contract-v1.json", import.meta.url);

const MAX_U64 = (1n << 64n) - 1n;
const EPOCH_INDEX = 2n;

// Claim wallets are real ed25519 keys, so the program tests can sign claims for these leaves.
const PKCS8_ED25519 = hexToBytes("302e020100300506032b657004220420");
function walletOf(seed: Uint8Array): Uint8Array {
  const key = createPrivateKey({
    key: Buffer.from(concatBytes(PKCS8_ED25519, seed)),
    format: "der",
    type: "pkcs8",
  });
  const jwk = createPublicKey(key).export({ format: "jwk" });
  return new Uint8Array(Buffer.from(jwk.x as string, "base64url"));
}

const seedOf = (n: number) => new Uint8Array(32).fill(n);
const evidenceOf = (n: number) => sha256(utf8ToBytes(`hyphae vector evidence ${n}`));

const LEAF_INPUTS: { name: string; n: number; score: bigint; amount: bigint }[] = [
  { name: "a", n: 1, score: 255n, amount: 121_250_000n },
  { name: "b", n: 2, score: 85n, amount: 108_486_842n },
  { name: "c", n: 3, score: 40n, amount: 51_052_631n },
  // A member can have score 0 and a positive amount (O5: weight is exact units).
  { name: "d", n: 4, score: 0n, amount: 1n },
  { name: "e", n: 5, score: MAX_U64, amount: 7n },
];

const leafOf = (i: (typeof LEAF_INPUTS)[number]): Leaf => ({
  wallet: walletOf(seedOf(i.n)),
  epochIndex: EPOCH_INDEX,
  score: i.score,
  amount: i.amount,
  evidenceHash: evidenceOf(i.n),
});

const compareBytes = (a: Uint8Array, b: Uint8Array) => {
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.length - b.length;
};

function merkleVectors() {
  const leaves = LEAF_INPUTS.map((i) => {
    const leaf = leafOf(i);
    return {
      name: i.name,
      seed: bytesToHex(seedOf(i.n)),
      wallet: bytesToHex(leaf.wallet),
      epoch_index: EPOCH_INDEX.toString(),
      score: i.score.toString(),
      amount: i.amount.toString(),
      evidence_hash: bytesToHex(leaf.evidenceHash),
      encoded: bytesToHex(encodeLeaf(leaf)),
      hash: bytesToHex(leafHash(leaf)),
    };
  });
  const trees = [1, 2, 3, 5].map((size) => {
    // Leaves enter the tree ordered by leaf hash, so the root depends on the leaves alone.
    const members = leaves
      .slice(0, size)
      .sort((x, y) => compareBytes(hexToBytes(x.hash), hexToBytes(y.hash)));
    const tree = buildTree(members.map((m) => hexToBytes(m.hash)));
    return {
      leaves: members.map((m) => m.name),
      root: bytesToHex(tree.root),
      proofs: Object.fromEntries(
        members.map((m, i) => [m.name, getProof(tree, i).map((p) => bytesToHex(p))]),
      ),
    };
  });
  const three = trees[2] as (typeof trees)[number];
  const proofB = three.proofs.b as string[];
  const flipped = hexToBytes(proofB[0] as string);
  flipped[31] = (flipped[31] as number) ^ 0x01;
  return {
    leaves,
    trees,
    tampered: [
      { tree: 3, leaf: "b", proof: [bytesToHex(flipped), ...proofB.slice(1)], valid: false },
    ],
  };
}

// Anchor's default discriminators: the first 8 bytes of sha256("global:<ix>") and
// sha256("account:<Name>").
const disc = (preimage: string) => sha256(utf8ToBytes(preimage)).slice(0, 8);
const u64 = (v: bigint) => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, v, true);
  return out;
};
const i64 = (v: bigint) => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, v, true);
  return out;
};
const u32 = (v: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, v, true);
  return out;
};
const key = (n: number) => walletOf(seedOf(0x40 + n));

function programVectors() {
  const community = {
    mint: bytesToHex(key(1)),
    admin: bytesToHex(key(2)),
    fee_recipient: bytesToHex(key(3)),
    outstanding_lamports: "280789473",
    bump: 254,
    vault_bump: 253,
  };
  const epoch = {
    community: bytesToHex(key(4)),
    index: "2",
    root: bytesToHex(sha256(utf8ToBytes("root"))),
    audit_hash: bytesToHex(sha256(utf8ToBytes("audit"))),
    gross_lamports: "500000000",
    fee_lamports: "15000000",
    allocated_lamports: "280789473",
    claimed_lamports: "121250000",
    published_at: "1791518400",
    bump: 251,
  };
  const receipt = {
    epoch: bytesToHex(key(5)),
    wallet: bytesToHex(key(6)),
    score: "255",
    amount: "121250000",
    evidence_hash: bytesToHex(evidenceOf(1)),
    claimed_at: "1791522000",
    bump: 250,
  };
  const b = (h: string) => hexToBytes(h);
  const proof = [sha256(utf8ToBytes("p1")), sha256(utf8ToBytes("p2"))];
  return {
    instructions: {
      initialize_community: {
        discriminator: bytesToHex(disc("global:initialize_community")),
        accounts: [
          { name: "admin", writable: true, signer: true },
          { name: "mint", writable: false, signer: false },
          { name: "community", writable: true, signer: false },
          { name: "vault", writable: true, signer: false },
          { name: "system_program", writable: false, signer: false },
        ],
        args: { fee_recipient: community.fee_recipient },
        data: bytesToHex(
          concatBytes(disc("global:initialize_community"), b(community.fee_recipient)),
        ),
      },
      publish_epoch: {
        discriminator: bytesToHex(disc("global:publish_epoch")),
        accounts: [
          { name: "admin", writable: true, signer: true },
          { name: "community", writable: true, signer: false },
          { name: "vault", writable: true, signer: false },
          { name: "fee_recipient", writable: true, signer: false },
          { name: "epoch", writable: true, signer: false },
          { name: "system_program", writable: false, signer: false },
        ],
        args: {
          index: epoch.index,
          root: epoch.root,
          audit_hash: epoch.audit_hash,
          gross_lamports: epoch.gross_lamports,
          allocated_lamports: epoch.allocated_lamports,
        },
        data: bytesToHex(
          concatBytes(
            disc("global:publish_epoch"),
            u64(BigInt(epoch.index)),
            b(epoch.root),
            b(epoch.audit_hash),
            u64(BigInt(epoch.gross_lamports)),
            u64(BigInt(epoch.allocated_lamports)),
          ),
        ),
      },
      claim: {
        discriminator: bytesToHex(disc("global:claim")),
        accounts: [
          { name: "claimant", writable: true, signer: true },
          { name: "community", writable: true, signer: false },
          { name: "vault", writable: true, signer: false },
          { name: "epoch", writable: true, signer: false },
          { name: "receipt", writable: true, signer: false },
          { name: "system_program", writable: false, signer: false },
        ],
        args: {
          score: receipt.score,
          amount: receipt.amount,
          evidence_hash: receipt.evidence_hash,
          proof: proof.map((p) => bytesToHex(p)),
        },
        data: bytesToHex(
          concatBytes(
            disc("global:claim"),
            u64(BigInt(receipt.score)),
            u64(BigInt(receipt.amount)),
            b(receipt.evidence_hash),
            u32(proof.length),
            ...proof,
          ),
        ),
      },
    },
    accounts: {
      community: {
        discriminator: bytesToHex(disc("account:Community")),
        fields: community,
        data: bytesToHex(
          concatBytes(
            disc("account:Community"),
            b(community.mint),
            b(community.admin),
            b(community.fee_recipient),
            u64(BigInt(community.outstanding_lamports)),
            Uint8Array.of(community.bump, community.vault_bump),
          ),
        ),
      },
      vault: {
        discriminator: bytesToHex(disc("account:Vault")),
        fields: { bump: 252 },
        data: bytesToHex(concatBytes(disc("account:Vault"), Uint8Array.of(252))),
      },
      epoch: {
        discriminator: bytesToHex(disc("account:Epoch")),
        fields: epoch,
        data: bytesToHex(
          concatBytes(
            disc("account:Epoch"),
            b(epoch.community),
            u64(BigInt(epoch.index)),
            b(epoch.root),
            b(epoch.audit_hash),
            u64(BigInt(epoch.gross_lamports)),
            u64(BigInt(epoch.fee_lamports)),
            u64(BigInt(epoch.allocated_lamports)),
            u64(BigInt(epoch.claimed_lamports)),
            i64(BigInt(epoch.published_at)),
            Uint8Array.of(epoch.bump),
          ),
        ),
      },
      claim_receipt: {
        discriminator: bytesToHex(disc("account:ClaimReceipt")),
        fields: receipt,
        data: bytesToHex(
          concatBytes(
            disc("account:ClaimReceipt"),
            b(receipt.epoch),
            b(receipt.wallet),
            u64(BigInt(receipt.score)),
            u64(BigInt(receipt.amount)),
            b(receipt.evidence_hash),
            i64(BigInt(receipt.claimed_at)),
            Uint8Array.of(receipt.bump),
          ),
        ),
      },
    },
  };
}

function computeVectors() {
  return {
    version: "h-contract-v1",
    merkle: merkleVectors(),
    program: programVectors(),
  };
}

type Vectors = ReturnType<typeof computeVectors>;

describe("H-CONTRACT v1 vectors", () => {
  const computed = computeVectors();
  if (process.env.UPDATE_VECTORS === "1") {
    writeFileSync(FILE, `${JSON.stringify(computed, null, 2)}\n`);
  }
  const committed = JSON.parse(readFileSync(FILE, "utf8")) as Vectors;

  it("the committed file is what the code computes", () => {
    expect(committed).toEqual(computed);
  });

  it("leaves are 89 bytes with the 0x00 prefix, and wallets are the seeds' ed25519 keys", () => {
    for (const l of committed.merkle.leaves) {
      const bytes = hexToBytes(l.encoded);
      expect(bytes.length).toBe(89);
      expect(bytes[0]).toBe(0x00);
      expect(bytesToHex(sha256(bytes))).toBe(l.hash);
    }
    // RFC 8032 test 1's key pair, so walletOf is ed25519 and not an accident of this file.
    const rfc8032 = hexToBytes("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
    expect(bytesToHex(walletOf(rfc8032))).toBe(
      "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    );
  });

  it("every proof verifies against its tree's root", () => {
    const hashOf = new Map(committed.merkle.leaves.map((l) => [l.name, hexToBytes(l.hash)]));
    for (const tree of committed.merkle.trees) {
      for (const name of tree.leaves) {
        const proof = (tree.proofs as Record<string, string[]>)[name] as string[];
        expect(
          verifyProof(
            hexToBytes(tree.root),
            hashOf.get(name) as Uint8Array,
            proof.map((p) => hexToBytes(p)),
          ),
        ).toBe(true);
      }
    }
  });

  it("a tampered proof fails", () => {
    const hashOf = new Map(committed.merkle.leaves.map((l) => [l.name, hexToBytes(l.hash)]));
    for (const t of committed.merkle.tampered) {
      const tree = committed.merkle.trees.find((x) => x.leaves.length === t.tree);
      expect(
        verifyProof(
          hexToBytes(tree?.root as string),
          hashOf.get(t.leaf) as Uint8Array,
          t.proof.map((p) => hexToBytes(p)),
        ),
      ).toBe(t.valid);
    }
  });
});
