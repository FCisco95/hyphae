import { afterEach, describe, expect, it, vi } from "vitest";
import { readMemberState, requestGeneration } from "./member-session.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("member session read isolation", () => {
  it("discards an old user's response after logout", async () => {
    let finish!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const received: string[] = [];
    const generation = requestGeneration();
    const read = generation.run(
      () => pending,
      (value) => received.push(value),
    );
    generation.invalidate();
    finish("previous-user-private-wallet");
    await read;
    expect(received).toEqual([]);
  });
  it("only applies the newest read across linking or account changes", async () => {
    let finish!: (value: string) => void;
    const received: string[] = [];
    const generation = requestGeneration();
    const old = generation.run(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
      (value) => received.push(value),
    );
    await generation.run(
      async () => "new-user",
      (value) => received.push(value),
    );
    finish("old-user");
    await old;
    expect(received).toEqual(["new-user"]);
  });
  it("aborts the active request when cleared", async () => {
    let seen: AbortSignal | undefined;
    const generation = requestGeneration();
    await generation.run(
      async (signal) => {
        seen = signal;
        return "value";
      },
      () => {},
    );
    generation.invalidate();
    expect(seen?.aborted).toBe(true);
  });
});

describe("browser private member reads", () => {
  it.each(["deadline", "caller"] as const)(
    "cancels a stalled browser read on %s",
    async (reason) => {
      vi.useFakeTimers();
      try {
        let seen: AbortSignal | undefined;
        vi.stubGlobal("fetch", (_input: unknown, options: RequestInit) => {
          seen = options.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) =>
            seen?.addEventListener("abort", () => reject(new Error("fixture abort")), {
              once: true,
            }),
          );
        });
        const caller = new AbortController();
        const result = readMemberState("MintA", caller.signal);
        if (reason === "deadline") await vi.advanceTimersByTimeAsync(6500);
        else caller.abort();
        expect(await result).toEqual({ kind: "unavailable" });
        expect(seen?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it("works without AbortSignal.any support", async () => {
    vi.spyOn(AbortSignal, "any").mockImplementation(() => {
      throw new TypeError("not supported");
    });
    const account = {
      community: { mint: "MintA", name: "Fixture" },
      as_of: "2026-10-09T12:00:00Z",
      state: "telegram_required",
    };
    vi.stubGlobal("fetch", async () => Response.json(account));
    expect(await readMemberState("MintA", new AbortController().signal)).toEqual({
      kind: "account",
      account,
    });
  });
  it("clears expired sessions instead of retaining a profile", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: "unauthorized" }, { status: 401 }));
    expect(await readMemberState("MintA", new AbortController().signal)).toEqual({
      kind: "logged_out",
    });
  });
  it("accepts only a parsed account for this community", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({
        community: { mint: "OtherMint", name: "Other" },
        as_of: "2026-10-09T12:00:00Z",
        state: "telegram_required",
      }),
    );
    expect(await readMemberState("MintA", new AbortController().signal)).toEqual({
      kind: "unavailable",
    });
  });
  it("uses a same-origin cookie request with no cached member data", async () => {
    let actual: RequestInit | undefined;
    const account = {
      community: { mint: "MintA", name: "Fixture" },
      as_of: "2026-10-09T12:00:00Z",
      state: "telegram_required",
    };
    vi.stubGlobal("fetch", async (_path: unknown, options: RequestInit) => {
      actual = options;
      return Response.json(account);
    });
    expect(await readMemberState("MintA", new AbortController().signal)).toEqual({
      kind: "account",
      account,
    });
    expect(actual?.credentials).toBe("same-origin");
    expect(actual?.cache).toBe("no-store");
    expect(actual?.headers).toBeUndefined();
  });
});
