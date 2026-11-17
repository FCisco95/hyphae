import { OperatorOverviewSchema, OperatorPayableSchema } from "@hyphae/core";
import { payoutPolicies } from "@hyphae/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminRoutes } from "../admin/routes.js";
import type { SettleChain } from "../payout/distribution-settle.js";
import { settleCommunity } from "../payout/distribution-settle.js";
import { MYCEL_MINT } from "../payout/holds.js";
import { randomAddress, seedReadyEpoch } from "../payout/ready-seed.js";
import { FAKE_ADMIN, fakeSettleChain } from "../payout/settle-fake.js";
import { createTestDb } from "../rewards/test-db.js";
import { operatorAuthStore } from "./store.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SOL = 1_000_000_000n;
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

async function ready(mint?: string) {
  const chainAddress = randomAddress();
  const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress, ...(mint ? { mint } : {}) });
  return { seed, chainAddress };
}
const addPolicy = (communityId: string) =>
  t.db.insert(payoutPolicies).values({
    communityId,
    effectiveFromIndex: 1,
    thresholdVolumeLamports: 100n * SOL,
    basis: "cumulative",
    rewardBpsOfVolume: 100,
    autoPublish: false,
  });

function app(chain: SettleChain | (() => Promise<SettleChain>), admin = FAKE_ADMIN) {
  const store = operatorAuthStore();
  const build = typeof chain === "function" ? chain : async () => chain;
  const routes = adminRoutes({
    db: t.db,
    enabled: true,
    operator: {
      store,
      origins: ["https://hyphae.test"],
      network: "solana:devnet",
      onChainAdmin: async () => admin,
      settle: build,
      gate: { clock: () => NOW },
      now: () => NOW,
    },
  });
  const signIn = (mint: string) => store.open({ mint, wallet: FAKE_ADMIN }).token;
  const get = (path: string, token: string) =>
    routes.request(`/operator/${path}`, { headers: { authorization: `Bearer ${token}` } });
  return { routes, signIn, get };
}

async function ok(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response.json();
}

describe("operator overview", () => {
  it("shows the gate per epoch, no top-up before a decision, raids and job health", async () => {
    const { seed, chainAddress } = await ready();
    await addPolicy(seed.communityId);
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    const a = app(fake.chain);
    const body = OperatorOverviewSchema.parse(
      await ok(await a.get(`communities/${seed.mint}/overview`, a.signIn(seed.mint))),
    );
    expect(body.community).toMatchObject({
      mint: seed.mint,
      chain_address: chainAddress,
      network: "solana:devnet",
    });
    expect(body.hold).toEqual({ held: false });
    expect(body.policy).toEqual({ present: true });
    const first = body.epochs.find((e) => e.index === 1);
    expect(first).toMatchObject({
      status: "closed",
      published: false,
      decision: null,
      gate: { status: "ready", blockers: [], payable: 3, held: 0, not_payable: 1 },
    });
    expect(body.epochs.map((e) => e.index)).toEqual(
      [...body.epochs.map((e) => e.index)].sort((x, y) => y - x),
    );
    expect(body.top_up).toEqual({ status: "none" });
    expect(body.raids).toEqual({ by_state: [], active: [], deliveries: [] });
    // PGlite has no pg-boss schema: unavailable, never a silent zero.
    expect(body.jobs).toEqual({ status: "unavailable" });
    expect(body.as_of).toBe(NOW.toISOString());
  });

  it("prices the top-up as the gate-ready message does: planned, then rolled over", async () => {
    const planned = await ready();
    await addPolicy(planned.seed.communityId);
    const rich = fakeSettleChain({ community: planned.chainAddress, free: 2n * SOL });
    await settleCommunity(
      t.db,
      rich.chain,
      { communityId: planned.seed.communityId },
      { clock: () => NOW },
    );
    const a = app(rich.chain);
    const p = OperatorOverviewSchema.parse(
      await ok(
        await a.get(`communities/${planned.seed.mint}/overview`, a.signIn(planned.seed.mint)),
      ),
    );
    expect(p.top_up).toEqual({ status: "ok", epoch_index: 1, outcome: "planned", lamports: "0" });
    expect(p.epochs.find((e) => e.index === 1)?.decision).toBe("distribution_planned");

    const rolled = await ready();
    await addPolicy(rolled.seed.communityId);
    const poor = fakeSettleChain({ community: rolled.chainAddress, free: 4n * (SOL / 10n) });
    await settleCommunity(
      t.db,
      poor.chain,
      { communityId: rolled.seed.communityId },
      { clock: () => NOW },
    );
    const b = app(poor.chain);
    const r = OperatorOverviewSchema.parse(
      await ok(await b.get(`communities/${rolled.seed.mint}/overview`, b.signIn(rolled.seed.mint))),
    );
    expect(r.top_up).toEqual({
      status: "ok",
      epoch_index: 1,
      outcome: "rolled_over",
      lamports: String(6n * (SOL / 10n)),
    });
  });

  it("says why there is no top-up: no policy, chain unavailable, held", async () => {
    const plain = await ready();
    const fake = fakeSettleChain({ community: plain.chainAddress, free: SOL });
    const a = app(fake.chain);
    const none = OperatorOverviewSchema.parse(
      await ok(await a.get(`communities/${plain.seed.mint}/overview`, a.signIn(plain.seed.mint))),
    );
    expect(none.top_up).toEqual({ status: "no_policy" });
    expect(none.policy).toEqual({ present: false });

    const withPolicy = await ready();
    await addPolicy(withPolicy.seed.communityId);
    const down = app(async () => {
      throw new Error("rpc https://secret.example down");
    });
    const res = await down.get(
      `communities/${withPolicy.seed.mint}/overview`,
      down.signIn(withPolicy.seed.mint),
    );
    const text = await res.clone().text();
    expect(OperatorOverviewSchema.parse(await ok(res)).top_up).toEqual({
      status: "chain_unavailable",
    });
    expect(text).not.toContain("secret.example");

    const mycel = await ready(MYCEL_MINT);
    await addPolicy(mycel.seed.communityId);
    const m = app(fakeSettleChain({ community: mycel.chainAddress, free: 2n * SOL }).chain);
    const held = OperatorOverviewSchema.parse(
      await ok(await m.get(`communities/${MYCEL_MINT}/overview`, m.signIn(MYCEL_MINT))),
    );
    expect(held.hold).toEqual({ held: true });
    expect(held.top_up).toEqual({ status: "held" });
  });

  it("refuses a session for another community and a missing session", async () => {
    const one = await ready();
    const two = await ready();
    const a = app(fakeSettleChain({ community: one.chainAddress, free: SOL }).chain);
    const response = await a.get(`communities/${two.seed.mint}/overview`, a.signIn(one.seed.mint));
    expect(response.status).toBe(403);
    expect((await a.routes.request(`/operator/communities/${one.seed.mint}/overview`)).status).toBe(
      401,
    );
  });
});

describe("operator payable list", () => {
  it("lists the payable wallets only, sorted, with nothing beside them", async () => {
    const { seed, chainAddress } = await ready();
    const a = app(fakeSettleChain({ community: chainAddress, free: SOL }).chain);
    const raw = await ok(
      await a.get(`communities/${seed.mint}/epochs/1/payable`, a.signIn(seed.mint)),
    );
    const body = OperatorPayableSchema.parse(raw);
    const expected = [seed.wallets.effort, seed.wallets.ordinary, seed.wallets.floor].sort();
    expect(body).toEqual({ epoch_index: 1, gate_status: "ready", wallets: expected });
    const text = JSON.stringify(raw);
    expect(text).not.toContain(seed.wallets.unsigned);
    for (const member of Object.values(seed.members)) expect(text).not.toContain(member);
    expect(text).not.toMatch(/point|handle|telegram|member/i);
  });

  it("is empty for an open epoch and 404 for an unknown one", async () => {
    const { seed, chainAddress } = await ready();
    const a = app(fakeSettleChain({ community: chainAddress, free: SOL }).chain);
    const token = a.signIn(seed.mint);
    const open = OperatorPayableSchema.parse(
      await ok(await a.get(`communities/${seed.mint}/epochs/2/payable`, token)),
    );
    expect(open).toEqual({ epoch_index: 2, gate_status: "not_evaluated", wallets: [] });
    expect((await a.get(`communities/${seed.mint}/epochs/99/payable`, token)).status).toBe(404);
    expect((await a.get(`communities/${seed.mint}/epochs/x/payable`, token)).status).toBe(400);
  });
});
