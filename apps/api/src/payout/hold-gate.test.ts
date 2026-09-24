import { randomUUID } from "node:crypto";
import { communities, epochs, holdChecks, rulesTestPasses } from "@hyphae/db";
import { getAddressDecoder } from "@solana/kit";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedAuditDemo } from "../http/demo-seed.js";
import { createTestDb } from "../rewards/test-db.js";
import { evaluatePayoutGate } from "./gate.js";
import {
  dueHoldChecks,
  type HoldChecker,
  type HoldResult,
  holdCheckerFromEnv,
  runHoldChecks,
} from "./hold-gate.js";
import type { RulesTest } from "./rules-test.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const key = (fill: number) => getAddressDecoder().decode(new Uint8Array(32).fill(fill));
const OWNER = key(7);
const MINT = key(9);
const TOKEN_ACCOUNT = key(11);
const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const HELIUS = "https://mainnet.helius-rpc.com/?api-key=secret-key";
const FALLBACK = "https://rpc.fallback.test/secret-key";
const THRESHOLD = 100_000_000_000n;
const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

// One JSON-RPC provider as the SDK reads it: the mint, the owner's token accounts, the block time.
interface Provider {
  genesis?: string;
  amount?: string;
  status?: number;
  staleSeconds?: number;
  malformed?: boolean;
}
function rpc(providers: Record<string, Provider>) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url.host);
    const p = providers[url.host] ?? {};
    const { id, method } = JSON.parse(String(init?.body)) as { id: number; method: string };
    if (method === "getGenesisHash") {
      const result = p.genesis ?? MAINNET_GENESIS;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status: 200 });
    }
    // Faults apply to the balance reads, which the SDK classifies.
    if (p.status) return new Response("unavailable", { status: p.status });
    if (p.malformed) return new Response("{not json", { status: 200 });
    const parsed = (type: string, info: object) => ({
      executable: false,
      owner: SPL_TOKEN,
      data: { program: "spl-token", parsed: { type, info } },
    });
    const result =
      method === "getAccountInfo"
        ? {
            context: { slot: 1000 },
            value: parsed("mint", { isInitialized: true, decimals: 6 }),
          }
        : method === "getTokenAccountsByOwner"
          ? {
              context: { slot: 1001 },
              value: [
                {
                  pubkey: TOKEN_ACCOUNT,
                  account: parsed("account", {
                    owner: OWNER,
                    mint: MINT,
                    state: "initialized",
                    tokenAmount: { amount: p.amount ?? "150000000000", decimals: 6 },
                  }),
                },
              ],
            }
          : Math.floor(Date.now() / 1000) - (p.staleSeconds ?? 0);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { status: 200 });
  }) as typeof fetch;
  return { impl, calls };
}

const input = () => ({
  projectId: randomUUID(),
  owner: OWNER,
  mint: MINT,
  thresholdRaw: THRESHOLD,
  checkRound: randomUUID(),
});
const env = { HOLD_RPC_HELIUS_URL: HELIUS, HOLD_RPC_FALLBACK_URL: FALLBACK };
const hosts = (a: Provider, b: Provider) =>
  rpc({ "mainnet.helius-rpc.com": a, "rpc.fallback.test": b });

describe("holdCheckerFromEnv, through the real SDK (consumer guide §7, hold gate)", () => {
  it("agreeing providers at or above the threshold: holder", async () => {
    for (const amount of ["150000000000", "100000000000"]) {
      const { impl } = hosts({ amount }, { amount });
      expect(await holdCheckerFromEnv(env, impl)(input())).toMatchObject({
        kind: "holder",
        rawAmount: BigInt(amount),
        decimals: 6,
        provider: "consensus",
      });
    }
  });

  it("agreeing providers below the threshold: below", async () => {
    const { impl } = hosts({ amount: "99999999999" }, { amount: "99999999999" });
    expect(await holdCheckerFromEnv(env, impl)(input())).toMatchObject({
      kind: "below",
      rawAmount: 99_999_999_999n,
    });
  });

  it("disagreement, an outage, stale or malformed evidence: uncertain, never below", async () => {
    const cases: [Provider, Provider, string][] = [
      [{ amount: "150000000000" }, { amount: "90000000000" }, "conflict"],
      [{}, { status: 503 }, "outage"],
      [{ status: 503 }, {}, "outage"],
      [{ staleSeconds: 600 }, {}, "stale"],
      [{}, { malformed: true }, "invalid-response"],
    ];
    for (const [a, b, reason] of cases) {
      const { impl } = hosts(a, b);
      expect(await holdCheckerFromEnv(env, impl)(input()), reason).toEqual({
        kind: "uncertain",
        reason,
      });
    }
  });

  it("missing or invalid provider configuration: not configured, and no request", async () => {
    const { impl, calls } = hosts({}, {});
    for (const bad of [
      { HOLD_RPC_HELIUS_URL: HELIUS },
      { HOLD_RPC_FALLBACK_URL: FALLBACK },
      {},
      { ...env, HOLD_RPC_FALLBACK_URL: "http://rpc.fallback.test/" },
      { ...env, HOLD_RPC_HELIUS_URL: "not a url" },
    ]) {
      expect(await holdCheckerFromEnv(bad, impl)(input())).toEqual({
        kind: "uncertain",
        reason: "not_configured",
      });
    }
    expect(calls).toEqual([]);
  });

  it("providers that are not independent: uncertain", async () => {
    const { impl } = rpc({ "mainnet.helius-rpc.com": {}, "rpc.helius.xyz": {} });
    for (const fallback of ["https://mainnet.helius-rpc.com/other", "https://rpc.helius.xyz/"]) {
      expect(
        await holdCheckerFromEnv({ ...env, HOLD_RPC_FALLBACK_URL: fallback }, impl)(input()),
      ).toEqual({ kind: "uncertain", reason: "invalid-response" });
    }
  });

  it("a provider on another network: uncertain, whatever the balances say", async () => {
    for (const [a, b] of [
      [{ genesis: DEVNET_GENESIS }, {}],
      [{}, { genesis: DEVNET_GENESIS }],
      [{ genesis: DEVNET_GENESIS }, { genesis: DEVNET_GENESIS }],
    ] as [Provider, Provider][]) {
      const { impl } = hosts(a, b);
      expect(await holdCheckerFromEnv(env, impl)(input())).toEqual({
        kind: "uncertain",
        reason: "wrong_network",
      });
    }
  });

  it("a genesis answer that is not a clean JSON-RPC result confirms nothing", async () => {
    const { impl } = hosts({ amount: "150000000000" }, { amount: "150000000000" });
    for (const reply of [
      { jsonrpc: "2.0", id: 2, result: MAINNET_GENESIS },
      { jsonrpc: "1.0", id: 1, result: MAINNET_GENESIS },
      { result: MAINNET_GENESIS },
      { jsonrpc: "2.0", id: 1, result: MAINNET_GENESIS, error: { code: -1 } },
      [{ jsonrpc: "2.0", id: 1, result: MAINNET_GENESIS }],
    ]) {
      const odd = (async (url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { method: string };
        if (body.method === "getGenesisHash") return new Response(JSON.stringify(reply));
        return impl(url, init);
      }) as typeof fetch;
      expect(await holdCheckerFromEnv(env, odd)(input()), JSON.stringify(reply)).toEqual({
        kind: "uncertain",
        reason: "outage",
      });
    }
  });

  it("a network it cannot confirm is an outage, and is asked again next time", async () => {
    let down = true;
    const { impl } = hosts({ amount: "150000000000" }, { amount: "150000000000" });
    const flaky = (async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string };
      if (down && body.method === "getGenesisHash") return new Response("no", { status: 503 });
      return impl(url, init);
    }) as typeof fetch;
    const check = holdCheckerFromEnv(env, flaky);
    expect(await check(input())).toEqual({ kind: "uncertain", reason: "outage" });
    down = false;
    expect(await check(input())).toMatchObject({ kind: "holder" });
  });

  it("an owner or mint that is not a Solana address: uncertain, not an exception", async () => {
    const { impl } = hosts({}, {});
    const check = holdCheckerFromEnv(env, impl);
    expect(await check({ ...input(), owner: "DemoWallet" })).toEqual({
      kind: "uncertain",
      reason: "invalid-response",
    });
    expect(await check({ ...input(), mint: "DemoMint" })).toEqual({
      kind: "uncertain",
      reason: "invalid-response",
    });
  });
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const DEMO_TEST: RulesTest = {
  id: "demo-rules-1",
  covers: [{ community: "DEMO", version: "1.2.0" }],
  questions: [{ text: "?", options: ["a", "b"], answer: 0, why: "because" }],
};
const tests = [DEMO_TEST];

const observed = (kind: "holder" | "below", rawAmount: bigint, observedAt: Date): HoldResult => ({
  kind,
  rawAmount,
  decimals: 6,
  provider: "consensus",
  slot: 4242n,
  observedAt,
});
const HOUR = 3_600_000;
const sinceClose = (e: { closesAt: Date }, ms: number) => new Date(e.closesAt.getTime() + ms);
// Fixture epochs close in the future of the real clock, so runs get a clock inside the window.
const inWindow = (e: { closesAt: Date }) => () => sinceClose(e, HOUR);

// A checker that answers from a script and records what it was asked.
function scripted(...answers: (HoldResult | (() => Promise<HoldResult>))[]) {
  const calls: Parameters<HoldChecker>[0][] = [];
  const check: HoldChecker = async (i) => {
    calls.push(i);
    const next = answers.shift();
    if (!next) throw new Error("unexpected hold check");
    return typeof next === "function" ? next() : next;
  };
  return { check, calls };
}

// The demo's closed epoch, first paid, with the signed member's pass: a candidate with no hold yet.
async function candidateDemo() {
  const demo = await seedAuditDemo(t.db, NOW);
  const [e1] = await t.db
    .select()
    .from(epochs)
    .where(and(eq(epochs.communityId, demo.communityId), eq(epochs.index, 1)));
  if (!e1) throw new Error("demo: epoch 1");
  await t.db
    .update(communities)
    .set({ firstPaidEpoch: 1 })
    .where(eq(communities.id, demo.communityId));
  await t.db.insert(rulesTestPasses).values({
    communityId: demo.communityId,
    memberId: demo.members.signed,
    testId: DEMO_TEST.id,
    passedAt: new Date(e1.closesAt.getTime() - 60_000),
  });
  const rows = () => t.db.select().from(holdChecks).where(eq(holdChecks.epochId, e1.id));
  return { demo, e1, ref: { communityId: demo.communityId, epochId: e1.id }, rows };
}

const statusOf = async (ref: { communityId: string; epochId: string }, memberId: string) => {
  const gate = await evaluatePayoutGate(t.db, ref, { tests });
  return [gate.status, gate.members.find((m) => m.memberId === memberId)?.status];
};

describe("runHoldChecks", () => {
  it("checks only candidates; an uncertain result holds, a confirmed retry releases the claim", async () => {
    const { demo, e1, ref, rows } = await candidateDemo();
    const first = scripted({ kind: "uncertain", reason: "outage" });
    expect(
      await runHoldChecks(t.db, ref, { check: first.check, tests, clock: inWindow(e1) }),
    ).toEqual({
      status: "checked",
      holder: 0,
      below: 0,
      uncertain: 1,
    });
    const [row] = await rows();
    expect(row).toMatchObject({
      memberId: demo.members.signed,
      status: "uncertain",
      reason: "outage",
      attempts: 1,
    });
    expect(first.calls).toEqual([
      {
        projectId: demo.communityId,
        owner: demo.signedWallet,
        mint: demo.mint,
        thresholdRaw: THRESHOLD,
        checkRound: row?.checkRound,
      },
    ]);
    expect(await statusOf(ref, demo.members.signed)).toEqual(["blocked", "held"]);

    const retry = scripted(observed("holder", 150_000_000_000n, sinceClose(e1, 5 * 60_000)));
    await runHoldChecks(t.db, ref, { check: retry.check, tests, clock: inWindow(e1) });
    expect(retry.calls[0]?.checkRound).toBe(row?.checkRound);
    const [cleared] = await rows();
    expect(cleared).toMatchObject({
      status: "holder",
      attempts: 2,
      rawAmount: "150000000000",
      decimals: 6,
      provider: "consensus",
      slot: "4242",
    });
    expect(await statusOf(ref, demo.members.signed)).toEqual(["ready", "payable"]);
  });

  it("a confirmed result is final: no second call, no change", async () => {
    const { demo, e1, ref, rows } = await candidateDemo();
    await runHoldChecks(t.db, ref, {
      check: scripted(observed("below", 5n, sinceClose(e1, 5 * 60_000))).check,
      tests,
      clock: inWindow(e1),
    });
    expect(await statusOf(ref, demo.members.signed)).toEqual(["blocked", "not_payable"]);
    const later = scripted(observed("holder", 150_000_000_000n, sinceClose(e1, 5 * 60_000)));
    expect(
      await runHoldChecks(t.db, ref, { check: later.check, tests, clock: inWindow(e1) }),
    ).toEqual({
      status: "checked",
      holder: 0,
      below: 0,
      uncertain: 0,
    });
    expect(later.calls).toEqual([]);
    expect((await rows())[0]).toMatchObject({ status: "below", rawAmount: "5", attempts: 1 });
  });

  it("does not start before the close, and keeps an answer observed before it undecided", async () => {
    const { e1, ref, rows } = await candidateDemo();
    const none = scripted();
    expect(
      await runHoldChecks(t.db, ref, { check: none.check, tests, clock: () => sinceClose(e1, -1) }),
    ).toEqual({ status: "too_early" });
    expect(none.calls).toEqual([]);
    expect(await rows()).toEqual([]);

    const early = scripted(observed("holder", 150_000_000_000n, sinceClose(e1, -1)));
    await runHoldChecks(t.db, ref, {
      check: early.check,
      tests,
      clock: () => sinceClose(e1, HOUR),
    });
    expect((await rows())[0]).toMatchObject({ status: "uncertain", reason: "before_close" });
  });

  it("records a missing provider configuration as uncertain", async () => {
    const { e1, ref, rows } = await candidateDemo();
    await runHoldChecks(t.db, ref, { check: holdCheckerFromEnv({}), tests, clock: inWindow(e1) });
    expect((await rows())[0]).toMatchObject({ status: "uncertain", reason: "not_configured" });
  });

  it("does nothing for an epoch the gate stops before the member stage", async () => {
    const { demo, e1, ref, rows } = await candidateDemo();
    const none = scripted();
    await t.db
      .update(communities)
      .set({ firstPaidEpoch: null })
      .where(eq(communities.id, demo.communityId));
    expect(
      await runHoldChecks(t.db, ref, { check: none.check, tests, clock: inWindow(e1) }),
    ).toEqual({
      status: "skipped",
      blockers: ["before_first_paid_epoch"],
    });
    const [e2] = await t.db
      .select()
      .from(epochs)
      .where(and(eq(epochs.communityId, demo.communityId), eq(epochs.index, 2)));
    expect(
      await runHoldChecks(
        t.db,
        { communityId: demo.communityId, epochId: e2?.id ?? "" },
        { check: none.check, tests },
      ),
    ).toEqual({ status: "skipped", blockers: ["not_final"] });
    expect(none.calls).toEqual([]);
    expect(await rows()).toEqual([]);
  });

  it("keeps a result that arrives after the window from standing as final", async () => {
    const { e1, ref, rows } = await candidateDemo();
    const late = scripted(observed("holder", 150_000_000_000n, sinceClose(e1, 24 * HOUR + 1)));
    let ticks = 0;
    // In the window when the run starts and before the call, past it once the answer is back.
    const clock = () => sinceClose(e1, ++ticks <= 2 ? 23 * HOUR : 24 * HOUR + 1);
    await runHoldChecks(t.db, ref, { check: late.check, tests, clock });
    expect(late.calls).toHaveLength(1);
    expect((await rows())[0]).toMatchObject({ status: "uncertain", reason: "window_closed" });
  });

  it("checks the window again before every read", async () => {
    const { e1, ref, rows } = await candidateDemo();
    const none = scripted();
    let ticks = 0;
    const clock = () => sinceClose(e1, ++ticks === 1 ? 23 * HOUR : 24 * HOUR + 1);
    await runHoldChecks(t.db, ref, { check: none.check, tests, clock });
    expect(none.calls).toEqual([]);
    expect((await rows())[0]).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("reads no balance once 24 hours have passed since closes_at", async () => {
    const { e1, ref, rows } = await candidateDemo();
    const none = scripted();
    expect(
      await runHoldChecks(t.db, ref, {
        check: none.check,
        tests,
        clock: () => sinceClose(e1, 24 * HOUR + 1),
      }),
    ).toEqual({ status: "window_closed" });
    expect(none.calls).toEqual([]);
    expect(await rows()).toEqual([]);
  });

  it("refuses a stored check for another wallet instead of re-checking around it", async () => {
    const { demo, e1, ref } = await candidateDemo();
    await t.db.insert(holdChecks).values({
      communityId: demo.communityId,
      epochId: e1.id,
      memberId: demo.members.signed,
      wallet: "SomeoneElse",
      mint: demo.mint,
      thresholdRaw: THRESHOLD.toString(),
      checkRound: randomUUID(),
    });
    await expect(
      runHoldChecks(t.db, ref, { check: scripted().check, tests, clock: inWindow(e1) }),
    ).rejects.toThrow(/does not match/);
  });
});

describe("dueHoldChecks", () => {
  const due = async (communityId: string, now: Date) =>
    (await dueHoldChecks(t.db, now)).filter((d) => d.communityId === communityId);

  it("returns closed paid epochs with checks still open, within 24 hours of closes_at", async () => {
    const { demo, e1, ref } = await candidateDemo();
    expect(await due(demo.communityId, sinceClose(e1, HOUR))).toEqual([ref]);
    expect(await due(demo.communityId, sinceClose(e1, 24 * HOUR))).toEqual([ref]);
    expect(await due(demo.communityId, sinceClose(e1, 25 * HOUR))).toEqual([]);

    await runHoldChecks(t.db, ref, {
      check: scripted({ kind: "uncertain", reason: "stale" }).check,
      tests,
      clock: () => sinceClose(e1, HOUR),
    });
    expect(await due(demo.communityId, sinceClose(e1, 2 * HOUR))).toEqual([ref]);
    expect(await due(demo.communityId, sinceClose(e1, 25 * HOUR))).toEqual([]);

    await runHoldChecks(t.db, ref, {
      check: scripted(observed("holder", 150_000_000_000n, sinceClose(e1, 3 * HOUR))).check,
      tests,
      clock: () => sinceClose(e1, 3 * HOUR),
    });
    expect(await due(demo.communityId, sinceClose(e1, 4 * HOUR))).toEqual([]);
  });

  it("skips epochs before the first paid epoch, and open epochs", async () => {
    const { demo, e1 } = await candidateDemo();
    await t.db
      .update(communities)
      .set({ firstPaidEpoch: 2 })
      .where(eq(communities.id, demo.communityId));
    expect(await due(demo.communityId, sinceClose(e1, HOUR))).toEqual([]);
  });
});
