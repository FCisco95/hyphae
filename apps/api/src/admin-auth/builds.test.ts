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
const lifetime = { blockhash: "B" as never, lastValidBlockHeight: 100n };

describe("buildStore message ownership", () => {
  it("never lets another session's identical build outlive the first session's ownership", () => {
    let t = 0;
    const store = buildStore({ now: () => t });
    const bytes = new Uint8Array([1, 2, 3]);
    const input = (sessionId: string) => ({
      sessionId,
      mint: "M",
      wallet: "W",
      plan,
      messageBytes: bytes,
      lifetime,
      expiresAt: new Date(t + BUILD_TTL_MS),
    });
    store.put(input("A"));
    t = 1_000;
    const b = store.put(input("B"));
    // A's own build would have expired here; B's has one more second to live.
    t = BUILD_TTL_MS + 1;
    expect(store.take(b.id, { sessionId: "B", mint: "M", kind: "publish" })).toEqual({
      status: "refused",
      reason: "build_unknown",
    });
  });

  it("lets the owning session take its own build of the same bytes again", () => {
    let t = 0;
    const store = buildStore({ now: () => t });
    const bytes = new Uint8Array([4, 5, 6]);
    const input = {
      sessionId: "A",
      mint: "M",
      wallet: "W",
      plan,
      messageBytes: bytes,
      lifetime,
      expiresAt: new Date(BUILD_TTL_MS),
    };
    store.put(input);
    t = 500;
    const again = store.put({ ...input, expiresAt: new Date(t + BUILD_TTL_MS) });
    expect(store.take(again.id, { sessionId: "A", mint: "M", kind: "publish" }).status).toBe("ok");
  });
});
