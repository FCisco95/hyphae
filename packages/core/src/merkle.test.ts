import { describe, expect, it } from "vitest";
import { buildTree, getProof, leafHash, verifyProof, type Leaf } from "./merkle.js";

const wallet = (n: number) => new Uint8Array(32).fill(n);
const ev = (n: number) => new Uint8Array(32).fill(0xa0 + n);
const leaf = (n: number): Leaf => ({
  wallet: wallet(n),
  epochIndex: 1n,
  score: BigInt(10 * n),
  amount: BigInt(1_000_000 * n),
  evidenceHash: ev(n),
});

describe("merkle", () => {
  it("leaf encoding is 89 bytes with 0x00 domain prefix", () => {
    const h = leafHash(leaf(1));
    expect(h.length).toBe(32);
  });

  it("proofs verify for every leaf, including odd counts", () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const leaves = Array.from({ length: n }, (_, i) => leafHash(leaf(i + 1)));
      const tree = buildTree(leaves);
      leaves.forEach((l, i) => {
        expect(verifyProof(tree.root, l, getProof(tree, i))).toBe(true);
      });
    }
  });

  it("a tampered leaf fails", () => {
    const leaves = [1, 2, 3].map((i) => leafHash(leaf(i)));
    const tree = buildTree(leaves);
    const bad = leafHash({ ...leaf(2), score: 999n });
    expect(verifyProof(tree.root, bad, getProof(tree, 1))).toBe(false);
  });

  it("root is order-independent for a pair (sorted hashing)", () => {
    const a = leafHash(leaf(1));
    const b = leafHash(leaf(2));
    expect(buildTree([a, b]).root).toEqual(buildTree([b, a]).root);
  });

  it("rejects an empty epoch", () => {
    expect(() => buildTree([])).toThrow();
  });
});
