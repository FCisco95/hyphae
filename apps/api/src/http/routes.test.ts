import { HYPHAE_PROGRAM_ID, ReadApiV1 } from "@hyphae/core";
import type { Db } from "@hyphae/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type PublishChain, publishEpoch } from "../payout/publish.js";
import { randomAddress, seedReadyEpoch } from "../payout/ready-seed.js";
import { createTestDb } from "../rewards/test-db.js";
import { type AuditDemo, seedAuditDemo } from "./demo-seed.js";
import { readRoutes } from "./routes.js";
import type { SettlementReader } from "./settlement.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const WALLET = "So11111111111111111111111111111111111111112";

let t: Awaited<ReturnType<typeof createTestDb>>;
let demo: AuditDemo;
let app: ReturnType<typeof readRoutes>;
beforeAll(async () => {
  t = await createTestDb();
  demo = await seedAuditDemo(t.db, NOW);
  app = readRoutes({ db: t.db, clock: async () => NOW });
});
afterAll(async () => {
  await t.close();
});

const get = (path: string) => app.request(path);

describe("read routes v1", () => {
  it("serve every route with a body that passes its schema", async () => {
    const m = demo.mint;
    const cases: [string, { parse: (v: unknown) => unknown }][] = [
      [`/communities/${m}`, ReadApiV1.community],
      [`/communities/${m}/epochs/1`, ReadApiV1.epoch],
      [`/communities/${m}/epochs/1/contributions`, ReadApiV1.contributions],
      [`/communities/${m}/leaderboard?epoch=1`, ReadApiV1.leaderboard],
      [`/contributions/${demo.contributions.upgraded}`, ReadApiV1.contribution],
      [`/wallets/${WALLET}/claims`, ReadApiV1.walletClaims],
    ];
    for (const [path, schema] of cases) {
      const r = await get(path);
      expect(r.status, path).toBe(200);
      expect(r.headers.get("access-control-allow-origin")).toBe("*");
      expect(r.headers.get("content-type")).toMatch(/application\/json/);
      schema.parse(await r.json());
    }
  });

  it("cache a final epoch longer than an open one", async () => {
    const m = demo.mint;
    expect((await get(`/communities/${m}/epochs/1`)).headers.get("cache-control")).toBe(
      "public, max-age=300",
    );
    expect((await get(`/communities/${m}/epochs/2`)).headers.get("cache-control")).toBe(
      "public, max-age=15",
    );
    expect((await get(`/communities/${m}`)).headers.get("cache-control")).toBe(
      "public, max-age=15",
    );
  });

  it("pass paging and the member filter through", async () => {
    const r = await get(
      `/communities/${demo.mint}/epochs/1/contributions?offset=1&limit=1&member=${demo.members.pasted}`,
    );
    const body = ReadApiV1.contributions.parse(await r.json());
    expect([body.total_contributions, body.offset, body.limit, body.contributions.length]).toEqual([
      3, 1, 1, 1,
    ]);
  });

  it("answer 404 for anything unknown, including a legacy or missing epoch", async () => {
    for (const path of [
      "/communities/NoSuchMint",
      `/communities/${demo.mint}/epochs/9`,
      `/communities/${demo.mint}/epochs/9/contributions`,
      `/communities/${demo.mint}/leaderboard?epoch=9`,
      "/contributions/00000000-0000-4000-8000-000000000000",
      `/communities/${demo.mint}/epochs/1/claims/So11111111111111111111111111111111111111112`,
      "/wallets/anything",
    ]) {
      const r = await get(path);
      expect(r.status, path).toBe(404);
      expect(await r.json()).toEqual({ error: "not_found" });
    }
  });

  it("answer 400 for malformed parameters", async () => {
    for (const path of [
      `/communities/${demo.mint}/epochs/0`,
      `/communities/${demo.mint}/epochs/1x`,
      `/communities/${demo.mint}/leaderboard`,
      `/communities/${demo.mint}/leaderboard?epoch=abc`,
      `/communities/${demo.mint}/epochs/1/contributions?limit=0`,
      `/communities/${demo.mint}/epochs/1/contributions?limit=101`,
      `/communities/${demo.mint}/epochs/1/contributions?offset=-1`,
      `/communities/${demo.mint}/epochs/1/contributions?member=not-a-uuid`,
      "/contributions/not-a-uuid",
      `/communities/${"x".repeat(65)}`,
      `/communities/${demo.mint}/epochs/1/claims/0OIl-not-base58`,
      "/wallets/0OIl-not-base58/claims",
      `/wallets/${WALLET}/claims?limit=101`,
      `/wallets/${WALLET}/claims?offset=x`,
    ]) {
      const r = await get(path);
      expect(r.status, path).toBe(400);
      expect(await r.json()).toEqual({ error: "bad_request" });
    }
  });

  it("answer 503 when the database fails, and log no detail", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = readRoutes({
      db: {
        transaction: async () => {
          throw new Error("connection refused secret-dsn");
        },
      } as unknown as Db,
      clock: async () => NOW,
    });
    const r = await broken.request(`/communities/${demo.mint}`);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "unavailable" });
    expect(JSON.stringify(err.mock.calls)).not.toContain("secret-dsn");
    err.mockRestore();
  });

  it("read the time from the database when no clock is given", async () => {
    const live = readRoutes({ db: t.db });
    const before = Date.now();
    const body = ReadApiV1.community.parse(
      await (await live.request(`/communities/${demo.mint}`)).json(),
    );
    expect(Math.abs(new Date(body.as_of).getTime() - before)).toBeLessThan(60_000);
  });

  it("limit each client per window and say so in every response", async () => {
    let clock = 0;
    const limited = readRoutes({
      db: t.db,
      clock: async () => NOW,
      limit: { limit: 2, windowMs: 60_000, now: () => clock },
    });
    const from = (ip: string) =>
      limited.request(`/communities/${demo.mint}`, { headers: { "fly-client-ip": ip } });
    const first = await from("192.0.2.1");
    expect(first.status).toBe(200);
    expect(
      ["ratelimit-policy", "ratelimit-limit", "ratelimit-remaining", "ratelimit-reset"].map((h) =>
        first.headers.get(h),
      ),
    ).toEqual(["2;w=60", "2", "1", "60"]);
    expect((await from("192.0.2.1")).headers.get("ratelimit-remaining")).toBe("0");
    const over = await from("192.0.2.1");
    expect(over.status).toBe(429);
    expect(over.headers.get("retry-after")).toBe("60");
    expect(over.headers.get("access-control-allow-origin")).toBe("*");
    expect(await over.json()).toEqual({ error: "unavailable" });
    // Another client has its own window, and a window resets.
    expect((await from("192.0.2.2")).status).toBe(200);
    clock = 60_000;
    expect((await from("192.0.2.1")).status).toBe(200);
  });

  it("accept only GET", async () => {
    const r = await app.request(`/communities/${demo.mint}`, { method: "POST" });
    expect(r.status).toBe(404);
  });
});

describe("the claim route and settled epochs", () => {
  const PUBLISH_TX = `5${"P".repeat(86)}`;
  async function publishedRoutes() {
    const community = randomAddress();
    const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress: community });
    const chain: PublishChain = {
      network: "solana:devnet",
      programId: HYPHAE_PROGRAM_ID,
      readCommunity: async () => ({
        address: community,
        feeRecipient: "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
      }),
      readEpoch: async () => null,
      publishEpoch: async () => PUBLISH_TX,
      publishSignature: async () => PUBLISH_TX,
    };
    await publishEpoch(t.db, chain, { ...seed, grossLamports: 500_000_000n });
    // A reader that cannot reach the chain: the leaf is still served, its status unavailable.
    const down: SettlementReader = {
      network: async () => {
        throw new Error("rpc down");
      },
      accounts: async () => {
        throw new Error("rpc down");
      },
      creation: async () => {
        throw new Error("rpc down");
      },
      latestBlockhash: async () => {
        throw new Error("rpc down");
      },
    };
    return { seed, app: readRoutes({ db: t.db, clock: async () => NOW, chain: down }) };
  }

  it("serve a wallet's claim, never cached, and keep a chain-read epoch briefly cached", async () => {
    const { seed, app: live } = await publishedRoutes();
    const r = await live.request(`/communities/${seed.mint}/epochs/1/claims/${seed.wallets.floor}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const claim = ReadApiV1.claim.parse(await r.json());
    expect(claim.payment).toEqual({ status: "unavailable", reason: "chain_unavailable" });

    const e = await live.request(`/communities/${seed.mint}/epochs/1`);
    const body = ReadApiV1.epoch.parse(await e.json());
    expect(body.final).toBe(true);
    expect(body.settlement?.allocation).toEqual({
      status: "unavailable",
      reason: "chain_unavailable",
    });
    expect(body.allocation).toEqual({ status: "unavailable", reason: "chain_unavailable" });
    expect(e.headers.get("cache-control")).toBe("public, max-age=15");
  });

  it("list a wallet's claims briefly cached, each leaf served even when the chain is down", async () => {
    const { seed, app: live } = await publishedRoutes();
    const r = await live.request(`/wallets/${seed.wallets.floor}/claims?limit=10`);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=15");
    const body = ReadApiV1.walletClaims.parse(await r.json());
    expect(body).toMatchObject({ wallet: seed.wallets.floor, total_claims: 1, limit: 10 });
    expect(body.claims.map((c) => [c.community.mint, c.payment])).toEqual([
      [seed.mint, { status: "unavailable", reason: "chain_unavailable" }],
    ]);
  });

  it("answer 404 for a wallet without a leaf in a published epoch", async () => {
    const { seed, app: live } = await publishedRoutes();
    const r = await live.request(
      `/communities/${seed.mint}/epochs/1/claims/${seed.wallets.unsigned}`,
    );
    expect(r.status).toBe(404);
  });
});
