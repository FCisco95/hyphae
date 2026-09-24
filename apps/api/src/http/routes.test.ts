import { ReadApiV1 } from "@hyphae/core";
import type { Db } from "@hyphae/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import { type AuditDemo, seedAuditDemo } from "./demo-seed.js";
import { readRoutes } from "./routes.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");

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

  it("accept only GET", async () => {
    const r = await app.request(`/communities/${demo.mint}`, { method: "POST" });
    expect(r.status).toBe(404);
  });
});
