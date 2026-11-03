import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@hyphae/db";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluatePayoutGate } from "./gate.js";
import { seedReadyEpoch } from "./ready-seed.js";

// Deploy order: the gate runs before migration 0023 is applied, when hold_rulings does not exist.
// It must judge every epoch exactly as before rulings existed. The table is dropped for real here
// and recreated from the migration file afterwards.
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const db = createDb(url);
const MIGRATIONS = fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url));

beforeAll(async () => {
  await migrate(db, { migrationsFolder: MIGRATIONS });
});
afterAll(async () => {
  await db.execute(sql.raw(`drop table if exists "hold_rulings" cascade`));
  const text = readFileSync(join(MIGRATIONS, "0023_payout_policies_and_distributions.sql"), "utf8");
  for (const chunk of text.split("--> statement-breakpoint")) {
    const statement = chunk.trim();
    if (!/"hold_rulings"/.test(statement.split("\n")[0] ?? "")) continue;
    await db.execute(sql.raw(statement));
  }
  await db.$client.end();
});

describe("the payout gate before migration 0023", () => {
  it("judges a ready epoch as before when hold_rulings does not exist", async () => {
    const s = await seedReadyEpoch(db, { now: new Date("2026-11-20T12:00:00.000Z") });
    const ref = { communityId: s.communityId, epochId: s.epochId };
    const clock = () => new Date("2026-11-20T12:00:00.000Z");
    const before = await evaluatePayoutGate(db, ref, { clock });
    await db.execute(sql.raw(`drop table "hold_rulings" cascade`));
    const without = await evaluatePayoutGate(db, ref, { clock });
    expect(before.status).toBe("ready");
    expect(without).toEqual(before);
  });
});
