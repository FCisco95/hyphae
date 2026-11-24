import { describe, expect, it } from "vitest";
import { BUILD_TTL_MS, buildStore } from "./builds.js";

const plan = {
  kind: "publish" as const,
  epochIndex: 1,
  args: {
    community: "C",
    index: 1n,
    root: "aa",
    auditHash: "bb",
    grossLamports: 1n,
    allocatedLamports: 1n,
    feeRecipient: "F",
  },
};
const lifetime = { blockhash: "B" as never, lastValidBlockHeight: 1_000n };
const who = (sessionId: string) => ({ sessionId, mint: "M", kind: "publish" as const });

function fixture(maxOwners?: number) {
  let t = 0;
  const store = buildStore({ now: () => t, ...(maxOwners ? { maxOwners } : {}) });
  const input = (sessionId: string, bytes: number[]) => ({
    sessionId,
    mint: "M",
    wallet: "W",
    plan,
    messageBytes: new Uint8Array(bytes),
    lifetime,
    expiresAt: new Date(t + BUILD_TTL_MS),
  });
  return {
    store,
    input,
    at: (ms: number) => {
      t = ms;
    },
  };
}

// ed25519 is deterministic: identical bytes built for two sessions share one admin signature.
// A message stays the first session's until the chain is past its last valid height.
describe("buildStore message ownership", () => {
  it("refuses another session's identical build that outlives the first build", () => {
    const f = fixture();
    f.store.put(f.input("A", [1, 2, 3]));
    f.at(1_000);
    const b = f.store.put(f.input("B", [1, 2, 3]));
    f.at(BUILD_TTL_MS + 1);
    expect(f.store.take(b.id, who("B"))).toEqual({ status: "refused", reason: "build_unknown" });
  });

  it("refuses it after the first build is gone, however long the chain stalls", () => {
    const f = fixture();
    f.store.put(f.input("A", [7, 8, 9]));
    // Hours later, block production stalled: the blockhash may still be valid.
    f.at(5 * 3_600_000);
    const b = f.store.put(f.input("B", [7, 8, 9]));
    f.store.recent("B", "M");
    expect(f.store.take(b.id, who("B"))).toEqual({ status: "refused", reason: "build_unknown" });
  });

  it("frees a message only once a verified height passes its last valid height", () => {
    const f = fixture();
    f.store.put(f.input("A", [4, 4, 4]));
    f.store.observe(lifetime.lastValidBlockHeight);
    const still = f.store.put(f.input("B", [4, 4, 4]));
    expect(f.store.take(still.id, who("B")).status).toBe("refused");
    f.store.observe(lifetime.lastValidBlockHeight + 1n);
    const freed = f.store.put(f.input("B", [4, 4, 4]));
    expect(f.store.take(freed.id, who("B")).status).toBe("ok");
  });

  it("lets the owning session take its own build of the same bytes again", () => {
    const f = fixture();
    f.store.put(f.input("A", [4, 5, 6]));
    f.at(500);
    const again = f.store.put(f.input("A", [4, 5, 6]));
    expect(f.store.take(again.id, who("A")).status).toBe("ok");
  });

  it("refuses a new message when full rather than evict an owner", () => {
    const f = fixture(1);
    f.store.put(f.input("A", [1]));
    expect(() => f.store.put(f.input("A", [2]))).toThrow(/too many/);
    // The same bytes again are not a new message.
    expect(() => f.store.put(f.input("A", [1]))).not.toThrow();
    f.store.observe(lifetime.lastValidBlockHeight + 1n);
    expect(() => f.store.put(f.input("A", [2]))).not.toThrow();
  });
});
