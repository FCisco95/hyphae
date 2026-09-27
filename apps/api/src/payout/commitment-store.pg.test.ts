import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createDb,
  rewardConfigs,
  rewardDecisions,
  rewardIntakes,
  rewardSnapshotEntries,
} from "@hyphae/db";
import { and, asc, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appendCorrection } from "../rewards/decisions.js";
import { at } from "../rewards/test-db.js";
import { backfillEpochCommitments, storedEpochCommitments } from "./commitment-store.js";
import { epochCommitments } from "./commitments.js";
import { commitmentCases } from "./commitments.test-cases.js";
import { HYPHAE_PROGRAM_ID } from "./program.js";
import { buildPublication } from "./publication.js";
import { seedReadyEpoch } from "./ready-seed.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const db = createDb(url);
const other = createDb(url);
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([db.$client.end(), other.$client.end()]);
});

commitmentCases(it, async () => ({ db, close: async () => {} }));

const NOW = new Date("2026-11-20T12:00:00.000Z");
const ROUNDS = 12;
const seeded = JSON.parse(
  readFileSync(
    new URL("../../../../packages/core/src/test-vectors/h-contract-v1.json", import.meta.url),
    "utf8",
  ),
).allocation.find((c: { name: string }) => c.name === "seeded_ready_epoch");

// Two pools, so the backfill and the correction really contend for the community lock. Asserted on
// final rows, repeated, never on timing.
describe("backfill racing a late correction", () => {
  it(`stores no stale hash and keeps the frozen selection (${ROUNDS} rounds)`, async () => {
    const orders = { backfillFirst: 0, correctionFirst: 0 };
    for (let i = 0; i < ROUNDS; i += 1) {
      const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
      const before = await epochCommitments(db, seed.epochId);
      const [entry] = await db
        .select()
        .from(rewardSnapshotEntries)
        .where(eq(rewardSnapshotEntries.memberId, seed.members.ordinary));
      if (!entry?.decisionId) throw new Error("seed: ordinary member has no selected decision");
      const [latest] = await db
        .select()
        .from(rewardDecisions)
        .where(eq(rewardDecisions.contributionId, entry.contributionId))
        .orderBy(asc(rewardDecisions.revision))
        .then((rows) => rows.slice(-1));
      if (!latest) throw new Error("seed: no decision to correct");

      const [filled, corrected] = await Promise.all([
        backfillEpochCommitments(db, seed),
        appendCorrection(
          other,
          {
            communityId: seed.communityId,
            contributionId: entry.contributionId,
            expectedRevision: latest.revision,
            changes: { rawQuality: latest.rawQuality === 40 ? 41 : 40 },
            reason: "Operator review after the close.",
            evidenceRefs: ["https://x.com/a/status/1"],
            actor: "script:reward-correct",
            idempotencyKey: `race-${seed.epochId}`,
          },
          // After the close, so the correction is explanatory only.
          { clock: at(NOW) },
        ),
      ]);
      if (corrected.status !== "appended") throw new Error(`correction ${corrected.status}`);
      expect(corrected.decision.affectsAllocation).toBe(false);

      // Whichever committed first, every stored hash is the one the rows determine.
      const after = await epochCommitments(db, seed.epochId);
      const decisions = await db
        .select()
        .from(rewardDecisions)
        .where(eq(rewardDecisions.epochId, seed.epochId));
      const correctionHash = decisions.find((d) => d.id === corrected.decision.id)?.decisionHash;
      for (const d of decisions) {
        if (d.id === corrected.decision.id && correctionHash === null) continue;
        expect(d.decisionHash).toBe(after.decisions.get(d.id)?.hash);
      }
      const intakes = await db
        .select()
        .from(rewardIntakes)
        .where(eq(rewardIntakes.epochId, seed.epochId));
      for (const intake of intakes) {
        expect(intake.evidenceHash).toBe(after.evidence.get(intake.contributionId)?.hash);
      }
      const [config] = await db
        .select()
        .from(rewardConfigs)
        .where(eq(rewardConfigs.communityId, seed.communityId));
      expect(config?.configHash).toBe(after.configHash);

      // The backfill filled the correction exactly when it ran second; otherwise publication
      // refuses until a later backfill fills it.
      const backfillFirst = correctionHash === null;
      orders[backfillFirst ? "backfillFirst" : "correctionFirst"] += 1;
      expect(filled).toEqual({
        configs: 1,
        evidence: 4,
        decisions: backfillFirst ? 5 : 6,
        snapshots: 4,
      });
      const settings = {
        network: "solana:devnet" as const,
        programId: HYPHAE_PROGRAM_ID,
        feeRecipient: "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
        grossLamports: BigInt(seeded.gross_lamports),
      };
      if (backfillFirst) {
        await expect(storedEpochCommitments(db, seed.epochId)).rejects.toThrow(
          /missing stored decision hash/,
        );
        await expect(buildPublication(db, seed, settings)).rejects.toThrow(
          /missing stored decision hash/,
        );
      }
      expect(await backfillEpochCommitments(db, seed)).toEqual({
        configs: 0,
        evidence: 0,
        decisions: backfillFirst ? 1 : 0,
        snapshots: 0,
      });
      expect(await storedEpochCommitments(db, seed.epochId)).toEqual(after);

      // The correction left every earlier commitment and the frozen selection alone.
      for (const [id, d] of before.decisions) expect(after.decisions.get(id)).toEqual(d);
      expect(after.evidence).toEqual(before.evidence);
      const [frozen] = await db
        .select()
        .from(rewardSnapshotEntries)
        .where(
          and(
            eq(rewardSnapshotEntries.snapshotId, entry.snapshotId),
            eq(rewardSnapshotEntries.contributionId, entry.contributionId),
          ),
        );
      expect(frozen?.decisionId).toBe(entry.decisionId);
      expect(frozen?.decisionHash).toBe(before.decisions.get(entry.decisionId)?.hash);

      const publication = await buildPublication(db, seed, settings);
      if (publication.status !== "ready") throw new Error("publication blocked");
      expect(publication.allocation.allocatedLamports.toString()).toBe(seeded.allocated_lamports);
      expect(publication.allocation.capRemainderLamports.toString()).toBe(
        seeded.cap_remainder_lamports,
      );
      expect(
        publication.audit.entries.find((e) => e.contribution_id === entry.contributionId)
          ?.decision_hash,
      ).toBe(before.decisions.get(entry.decisionId)?.hash);
    }
    expect(orders.backfillFirst + orders.correctionFirst).toBe(ROUNDS);
  }, 300_000);
});
