import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import { createDb, epochPayoutDecisions, payoutPolicies } from "@hyphae/db";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPublication } from "./publication.js";
import { type PublishChain, planPublication } from "./publish.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";

// Deploy order: this code can run before migration 0023 is applied. Without its tables the
// operator's publish must plan exactly as it did before the policy check existed (MYCEL's epochs
// 4 and 5 are published that way); any other database error still fails it. The tables are
// dropped for real here and recreated from the migration file afterwards.
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const db = createDb(url);
const MIGRATIONS = fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url));
const TABLES = ["epoch_payout_decisions", "payout_policies"];
const ABOUT_TABLES = /"(epoch_payout_decisions|payout_policies)"/;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: MIGRATIONS });
});
afterAll(async () => {
  await restorePolicyTables();
  await db.$client.end();
});

async function dropPolicyTables() {
  for (const table of TABLES) await db.execute(sql.raw(`drop table if exists "${table}" cascade`));
}

// The two tables' statements of 0023, in the file's order: create, foreign keys, indexes.
async function restorePolicyTables() {
  await dropPolicyTables();
  const text = readFileSync(join(MIGRATIONS, "0023_payout_policies_and_distributions.sql"), "utf8");
  for (const chunk of text.split("--> statement-breakpoint")) {
    const statement = chunk.trim();
    if (!statement || !ABOUT_TABLES.test(statement.split("\n")[0] ?? "")) continue;
    await db.execute(sql.raw(statement));
  }
}

const NOW = new Date("2026-11-20T12:00:00.000Z");
const GROSS = 500_000_000n;
const SETTINGS = {
  network: "solana:devnet" as const,
  programId: HYPHAE_PROGRAM_ID,
  feeRecipient: "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
};
const chainFor = (community: string): PublishChain => ({
  network: SETTINGS.network,
  programId: SETTINGS.programId,
  readCommunity: async () => ({ address: community, feeRecipient: SETTINGS.feeRecipient }),
  readEpoch: async () => null,
  publishEpoch: async () => "sig-publish",
  publishSignature: async () => "sig-publish",
});

describe("the operator's publish before migration 0023", () => {
  it("plans exactly as before when the payout tables do not exist", async () => {
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(db, { now: NOW, chainAddress });
    const ref = { communityId: seed.communityId, epochId: seed.epochId };
    const expected = await buildPublication(db, ref, { grossLamports: GROSS, ...SETTINGS });
    if (expected.status !== "ready") throw new Error("not ready");

    await dropPolicyTables();
    const plan = await planPublication(db, chainFor(chainAddress), {
      ...ref,
      grossLamports: GROSS,
    });
    if (plan.status !== "planned") throw new Error(`not planned: ${JSON.stringify(plan)}`);
    expect(plan).toMatchObject({ community: chainAddress, index: 1n, onChain: null });
    expect(plan.intent.auditHash).toBe(expected.auditHash);
    expect(plan.intent.root).toBe(expected.root);
    expect(plan.intent.leaves).toHaveLength(3);
  });

  // Review of 2443d22, P1: a blanket 42P01 fallback also covered a half-applied migration, a wrong
  // schema or any other missing relation, and could let a managed community publish by hand.
  it("throws when migration 0023 is only partly applied (one table present)", async () => {
    await restorePolicyTables();
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(db, { now: NOW, chainAddress });
    const ref = { communityId: seed.communityId, epochId: seed.epochId };
    await db.execute(sql.raw('drop table "epoch_payout_decisions" cascade'));
    await expect(
      planPublication(db, chainFor(chainAddress), { ...ref, grossLamports: GROSS }),
    ).rejects.toThrow(/migration 0023 is partly applied/);
  });

  it("refuses a policy-managed epoch once both tables exist", async () => {
    await restorePolicyTables();
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(db, { now: NOW, chainAddress });
    const ref = { communityId: seed.communityId, epochId: seed.epochId };
    const [policy] = await db
      .insert(payoutPolicies)
      .values({
        communityId: seed.communityId,
        effectiveFromIndex: 1,
        thresholdVolumeLamports: 1n,
        basis: "cumulative",
        rewardBpsOfVolume: 100,
        autoPublish: false,
      })
      .returning();
    if (!policy) throw new Error("policy");
    const refused = { status: "refused", reason: "policy_managed" };
    expect(
      await planPublication(db, chainFor(chainAddress), { ...ref, grossLamports: GROSS }),
    ).toEqual(refused);

    // A decision row alone, with the policy starting later, refuses too.
    await db
      .update(payoutPolicies)
      .set({ effectiveFromIndex: 2 })
      .where(sql`${payoutPolicies.id} = ${policy.id}`);
    expect(
      await planPublication(db, chainFor(chainAddress), { ...ref, grossLamports: GROSS }),
    ).toMatchObject({ status: "planned" });
    await db.insert(epochPayoutDecisions).values({
      communityId: seed.communityId,
      epochId: seed.epochId,
      policyId: policy.id,
      accrualLamports: 0n,
      outcome: "rolled_over",
      reason: "below_threshold",
    });
    expect(
      await planPublication(db, chainFor(chainAddress), { ...ref, grossLamports: GROSS }),
    ).toEqual(refused);
  });

  it("still fails on any other database error in the policy check", async () => {
    await restorePolicyTables();
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(db, { now: NOW, chainAddress });
    const ref = { communityId: seed.communityId, epochId: seed.epochId };
    await db.execute(
      sql.raw('alter table "payout_policies" rename column "effective_from_index" to "renamed"'),
    );
    try {
      await expect(
        planPublication(db, chainFor(chainAddress), { ...ref, grossLamports: GROSS }),
      ).rejects.toSatisfy(
        (error: unknown) => (error as { cause?: { code?: string } }).cause?.code === "42703",
      );
    } finally {
      await db.execute(
        sql.raw('alter table "payout_policies" rename column "renamed" to "effective_from_index"'),
      );
    }
  });
});
