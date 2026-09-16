import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes } from "@noble/hashes/utils.js";

// Domain separation: leaves and internal nodes hash under different prefixes so
// an internal node can never be presented as a leaf (second-preimage guard).
const LEAF_PREFIX = Uint8Array.of(0x00);
const NODE_PREFIX = Uint8Array.of(0x01);

export interface Leaf {
  wallet: Uint8Array; // 32
  epochIndex: bigint;
  score: bigint;
  amount: bigint; // lamports
  evidenceHash: Uint8Array; // 32
}

export interface Tree {
  root: Uint8Array;
  layers: Uint8Array[][]; // layers[0] = leaf hashes
}

function u64le(v: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, v, true);
  return out;
}

export function encodeLeaf(l: Leaf): Uint8Array {
  if (l.wallet.length !== 32 || l.evidenceHash.length !== 32) throw new Error("leaf: 32-byte fields required");
  return concatBytes(LEAF_PREFIX, l.wallet, u64le(l.epochIndex), u64le(l.score), u64le(l.amount), l.evidenceHash);
}

export const leafHash = (l: Leaf): Uint8Array => sha256(encodeLeaf(l));

function compare(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < 32; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function hashPair(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [lo, hi] = compare(a, b) <= 0 ? [a, b] : [b, a];
  return sha256(concatBytes(NODE_PREFIX, lo, hi));
}

// Odd nodes are promoted unchanged to the next layer (no duplication), so a
// proof never contains a sibling equal to the node itself.
export function buildTree(leafHashes: Uint8Array[]): Tree {
  if (leafHashes.length === 0) throw new Error("merkle: empty epoch");
  const layers: Uint8Array[][] = [leafHashes.slice()];
  while ((layers.at(-1) as Uint8Array[]).length > 1) {
    const prev = layers.at(-1) as Uint8Array[];
    const next: Uint8Array[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const l = prev[i] as Uint8Array;
      const r = prev[i + 1];
      next.push(r ? hashPair(l, r) : l);
    }
    layers.push(next);
  }
  return { root: (layers.at(-1) as Uint8Array[])[0] as Uint8Array, layers };
}

export function getProof(tree: Tree, index: number): Uint8Array[] {
  const proof: Uint8Array[] = [];
  let i = index;
  for (const layer of tree.layers.slice(0, -1)) {
    const sibling = layer[i ^ 1];
    if (sibling) proof.push(sibling);
    i = Math.floor(i / 2);
  }
  return proof;
}

export function verifyProof(root: Uint8Array, leaf: Uint8Array, proof: Uint8Array[]): boolean {
  const computed = proof.reduce((acc, p) => hashPair(acc, p), leaf);
  return compare(computed, root) === 0;
}
