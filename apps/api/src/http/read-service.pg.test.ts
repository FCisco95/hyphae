import { fileURLToPath } from "node:url";
import { createDb } from "@hyphae/db";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
