import { fileURLToPath } from "node:url";
import { ReadApiV1 } from "@hyphae/core";
import { createDb, schema } from "@hyphae/db";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedAuditDemo } from "./demo-seed.js";
import { readWalletRecord } from "./read-service.js";

// Read-path query plans on Postgres 17 through postgres-js (scripts/test-pg.sh).
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const db = createDb(url);

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await db.$client.end();
});

describe("a wallet's claims", () => {
  // The public route filters every leaf by wallet; without an index led by the wallet, each
  // request, even for an unknown wallet, reads the whole table.
  it("can find a wallet's leaves through an index led by the wallet", async () => {
    const plan = await db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      return tx.execute(sql`explain select id from leaves where wallet = 'W'`);
    });
    const text = JSON.stringify(plan);
    expect(text).toContain("leaves_wallet");
    expect(text).toMatch(/Index Cond: \(wallet = /);
  });
});

describe("a wallet's record", () => {
  // Every request starts with the query that finds the wallet's public intakes and the one that
  // finds its leaves (review F3), and a request for an unknown wallet runs those two alone.
  it("finds a wallet's public intakes and leaves through indexes led by the wallet", async () => {
    const queries: { query: string; params: unknown[] }[] = [];
    const logged = drizzle(db.$client, {
      schema,
      logger: { logQuery: (query, params) => void queries.push({ query, params }) },
    });
    const now = new Date("2026-11-20T12:00:00.000Z");
    expect(await readWalletRecord(logged, "W", { offset: 0, limit: 50 }, now)).toBeNull();
    const selects = queries.filter((q) => /^select\b/i.test(q.query));
    expect(selects).toHaveLength(2);
    const planOf = async (q: { query: string; params: unknown[] }) =>
      JSON.stringify(
        await db.$client.begin(async (tx) => {
          await tx`set local enable_seqscan = off`;
          return tx.unsafe(`explain ${q.query}`, q.params as string[]);
        }),
      );
    const [intakes, paid] = selects;
    if (!intakes || !paid) throw new Error("no query");
    const intakePlan = await planOf(intakes);
    expect(intakePlan).toContain("member_wallet_links_wallet");
    expect(intakePlan).toMatch(/Index Cond: \(wallet = /);
    const leafPlan = await planOf(paid);
    expect(leafPlan).toContain("leaves_wallet");
    expect(leafPlan).toMatch(/Index Cond: \(wallet = /);
  });

  it("reads every epoch that shows the wallet, through the production driver", async () => {
    const now = new Date("2026-11-20T12:00:00.000Z");
    const demo = await seedAuditDemo(db, now);
    const r = ReadApiV1.walletRecord.parse(
      await readWalletRecord(db, demo.signedWallet, { offset: 0, limit: 50 }, now),
    );
    expect(r.epochs.map((e) => [e.index, e.status, e.totals.points, e.payout])).toEqual([
      [2, "open", "70", { status: "unavailable", reason: "no_settlement" }],
      [1, "closed", "255", { status: "unavailable", reason: "no_settlement" }],
    ]);
    expect(r.totals).toMatchObject({ contributions: 3, counted: 3, credited: 2, points: "325" });
    expect(await readWalletRecord(db, demo.pastedWallet, { offset: 0, limit: 50 }, now)).toBeNull();
  });
});
