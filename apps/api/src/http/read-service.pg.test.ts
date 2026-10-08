import { fileURLToPath } from "node:url";
import { ReadApiV1 } from "@hyphae/core";
import { createDb } from "@hyphae/db";
import { sql } from "drizzle-orm";
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
  // Every request starts from the wallet's links, including a request for an unknown wallet.
  it("can find a wallet's links through an index led by the wallet", async () => {
    const plan = await db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      return tx.execute(sql`explain select member_id from member_wallet_links where wallet = 'W'`);
    });
    const text = JSON.stringify(plan);
    expect(text).toContain("member_wallet_links_wallet");
    expect(text).toMatch(/Index Cond: \(wallet = /);
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
