import type { EpochV1 } from "@hyphae/core";
import type { Db } from "@hyphae/db";
import { sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import {
  type Page,
  readClaim,
  readCommunity,
  readContribution,
  readContributions,
  readEpoch,
  readLeaderboard,
} from "./read-service.js";
import type { SettlementReader } from "./settlement.js";

// Public read API v1 (H-CONTRACT Part A): GET only, no auth, fixed error bodies (A11).

const MINT = /^[A-Za-z0-9]{1,64}$/;
const INDEX = /^[1-9]\d{0,8}$/;
const COUNT = /^\d{1,9}$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

class BadRequest extends Error {}

const index = (v: string | undefined) => {
  if (!v || !INDEX.test(v)) throw new BadRequest();
  return Number(v);
};
const mint = (v: string) => {
  if (!MINT.test(v)) throw new BadRequest();
  return v;
};
const wallet = (v: string) => {
  if (!WALLET.test(v)) throw new BadRequest();
  return v;
};
const uuid = (v: string) => {
  if (!UUID.test(v)) throw new BadRequest();
  return v.toLowerCase();
};
function page(c: Context): Page {
  const offset = c.req.query("offset") ?? "0";
  const limit = c.req.query("limit") ?? "50";
  const member = c.req.query("member");
  if (!COUNT.test(offset) || !COUNT.test(limit)) throw new BadRequest();
  const l = Number(limit);
  if (l < 1 || l > 100) throw new BadRequest();
  return {
    offset: Number(offset),
    limit: l,
    member: member === undefined ? undefined : uuid(member),
  };
}

// Database time, so `closed` and the current epoch agree with the reward writers' clock.
async function databaseNow(db: Db): Promise<Date> {
  const result = await db.execute(
    sql`select floor(extract(epoch from clock_timestamp()) * 1000)::double precision as ms`,
  );
  // postgres-js returns the rows; PGlite wraps them.
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    ms: number;
  }[];
  const ms = rows[0]?.ms;
  if (ms === undefined) throw new Error("read: no database time");
  return new Date(Number(ms));
}

// Settlement sections read the chain, so their state can change at any time: only a final epoch
// whose sections do not depend on the chain is cached long.
const readsChain = (e: EpochV1) =>
  e.allocation.status === "published" ||
  (e.allocation.status === "unavailable" && e.allocation.reason.startsWith("chain_"));

export function readRoutes(deps: {
  db: Db;
  clock?: () => Promise<Date>;
  // P14's chain reads; without it the settlement sections say chain_unconfigured.
  chain?: SettlementReader | undefined;
}) {
  const { db } = deps;
  const now = deps.clock ?? (() => databaseNow(db));
  const app = new Hono();

  app.use("*", async (c, next) => {
    await next();
    c.header("Access-Control-Allow-Origin", "*");
  });

  const send = (c: Context, body: unknown | null, final = false) => {
    if (body === null) return c.json({ error: "not_found" }, 404);
    c.header("Cache-Control", `public, max-age=${final ? 300 : 15}`);
    return c.json(body);
  };

  app.get("/communities/:mint", async (c) =>
    send(c, await readCommunity(db, mint(c.req.param("mint")), await now())),
  );
  app.get("/communities/:mint/epochs/:index", async (c) => {
    const body = await readEpoch(
      db,
      mint(c.req.param("mint")),
      index(c.req.param("index")),
      await now(),
      deps.chain,
    );
    return send(c, body, body?.final && !readsChain(body));
  });
  app.get("/communities/:mint/epochs/:index/claims/:wallet", async (c) => {
    const body = await readClaim(
      db,
      mint(c.req.param("mint")),
      index(c.req.param("index")),
      wallet(c.req.param("wallet")),
      await now(),
      deps.chain,
    );
    if (body === null) return c.json({ error: "not_found" }, 404);
    // Its blockhash expires in about a minute and its status changes with a claim.
    c.header("Cache-Control", "no-store");
    return c.json(body);
  });
  app.get("/communities/:mint/epochs/:index/contributions", async (c) => {
    const body = await readContributions(
      db,
      mint(c.req.param("mint")),
      index(c.req.param("index")),
      page(c),
      await now(),
    );
    return send(c, body, body?.epoch.final);
  });
  app.get("/communities/:mint/leaderboard", async (c) => {
    const body = await readLeaderboard(
      db,
      mint(c.req.param("mint")),
      index(c.req.query("epoch")),
      page(c),
      await now(),
    );
    return send(c, body, body?.final);
  });
  app.get("/contributions/:id", async (c) => {
    const body = await readContribution(db, uuid(c.req.param("id")), await now());
    return send(c, body, body?.epoch.final);
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((err, c) => {
    if (err instanceof BadRequest) return c.json({ error: "bad_request" }, 400);
    // The path and the error's class only: a driver message can carry connection details.
    console.error(JSON.stringify({ read: c.req.routePath, error: err.name }));
    return c.json({ error: "unavailable" }, 503);
  });
  return app;
}
