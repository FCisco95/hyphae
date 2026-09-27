import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  type Db,
  epochs,
  rewardConfigs,
  rewardDecisions,
  rewardDispatches,
  rewardIntakes,
  rewardSnapshotEntries,
} from "@hyphae/db";
import { asc, eq, sql } from "drizzle-orm";
import { seedAuditDemo } from "../http/demo-seed.js";
import { createTestDb } from "../rewards/test-db.js";
import { backfillEpochCommitments, storedEpochCommitments } from "./commitment-store.js";
import { epochCommitments } from "./commitments.js";
import { HYPHAE_PROGRAM_ID } from "./program.js";
import { buildPublication } from "./publication.js";
import { type PublishChain, publishEpoch } from "./publish.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SETTINGS = {
  network: "solana:devnet" as const,
  programId: HYPHAE_PROGRAM_ID,
  feeRecipient: "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
  grossLamports: 500_000_000n,
};

// The same assertions run against PGlite and the real PostgreSQL driver.
export function commitmentCases(
  register: (name: string, run: () => Promise<void>) => unknown,
  open: () => Promise<{ db: Db; close: () => Promise<void> }> = createTestDb,
): void {
  const check = (name: string, run: (db: Db) => Promise<void>) =>
    register(name, async () => {
      const t = await open();
      try {
        await run(t.db);
      } finally {
        await t.close();
      }
    });

  check("refuses publication until required stored hashes are filled", async (db) => {
    const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    await assert.rejects(() => buildPublication(db, seed, SETTINGS), /missing stored .* hash/);
  });

  check(
    "applies 0010 over populated pre-hash rows without changing their commitments",
    async (db) => {
      await db.transaction(async (tx) => {
        const seed = await seedReadyEpoch(tx, { now: NOW, storeCommitments: false });
        const expected = await epochCommitments(tx, seed.epochId);
        await tx.execute(sql`alter table reward_configs drop column config_hash`);
        await tx.execute(sql`alter table reward_intakes drop column evidence_hash`);
        await tx.execute(sql`alter table reward_decisions drop column decision_hash`);
        await tx.execute(sql`alter table reward_snapshot_entries drop column decision_hash`);
        const migration = readFileSync(
          new URL(
            "../../../../packages/db/drizzle/0010_reward_commitment_hashes.sql",
            import.meta.url,
          ),
          "utf8",
        );
        for (const statement of migration.split("--> statement-breakpoint")) {
          if (statement.trim()) await tx.execute(sql.raw(statement));
        }
        await assert.rejects(
          () => storedEpochCommitments(tx, seed.epochId),
          /missing stored .* hash/,
        );
        await backfillEpochCommitments(tx, seed);
        assert.deepEqual(await storedEpochCommitments(tx, seed.epochId), expected);
      });
    },
  );

  check(
    "backfills old rows reproducibly in predecessor order and pins the selected decision",
    async (db) => {
      const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
      const expected = await epochCommitments(db, seed.epochId);
      const first = await backfillEpochCommitments(db, seed);
      assert.deepEqual(first, { configs: 1, evidence: 4, decisions: 5, snapshots: 4 });
      assert.deepEqual(await storedEpochCommitments(db, seed.epochId), expected);
      const lineage = await db
        .select()
        .from(rewardDecisions)
        .where(eq(rewardDecisions.epochId, seed.epochId))
        .orderBy(asc(rewardDecisions.contributionId), asc(rewardDecisions.revision));
      for (const d of lineage) {
        assert.equal(d.decisionHash, expected.decisions.get(d.id)?.hash);
        if (d.predecessorId) {
          assert.equal(
            expected.decisions.get(d.id)?.payload.predecessor_hash,
            lineage.find((p) => p.id === d.predecessorId)?.decisionHash,
          );
        }
      }
      const selected = await db
        .select()
        .from(rewardSnapshotEntries)
        .where(eq(rewardSnapshotEntries.memberId, seed.members.effort));
      assert.equal(selected[0]?.revision, 2);
      assert.equal(
        selected[0]?.decisionHash,
        expected.decisions.get(selected[0]?.decisionId as string)?.hash,
      );
      const before = await buildPublication(db, seed, SETTINGS);
      assert.equal(before.status, "ready");
      assert.deepEqual(await backfillEpochCommitments(db, seed), {
        configs: 0,
        evidence: 0,
        decisions: 0,
        snapshots: 0,
      });
      assert.deepEqual(await buildPublication(db, seed, SETTINGS), before);
    },
  );

  check(
    "hashes late revisions without replacing the frozen selection or pending reasons",
    async (db) => {
      const demo = await seedAuditDemo(db, NOW);
      const [d] = await db
        .select()
        .from(rewardDecisions)
        .where(eq(rewardDecisions.contributionId, demo.contributions.offTopic));
      assert.ok(d);
      const ref = { communityId: d.communityId, epochId: d.epochId };
      const result = await backfillEpochCommitments(db, ref);
      assert.ok(result.decisions > result.snapshots);
      const computed = await storedEpochCommitments(db, d.epochId);
      const revisions = [...computed.decisions.values()].filter(
        (r) => r.payload.contribution_id === demo.contributions.offTopic,
      );
      assert.ok(
        revisions.some((r) => r.payload.source === "correction" && !r.payload.affects_allocation),
      );
      const [entry] = await db
        .select()
        .from(rewardSnapshotEntries)
        .where(eq(rewardSnapshotEntries.contributionId, demo.contributions.offTopic));
      assert.ok(entry?.decisionId);
      assert.equal(entry.revision, 1);
      assert.equal(entry.decisionHash, computed.decisions.get(entry.decisionId)?.hash);
      const pending = await db
        .select()
        .from(rewardSnapshotEntries)
        .where(eq(rewardSnapshotEntries.contributionId, demo.contributions.pendingAtClose));
      assert.ok(pending[0]?.reason);
      assert.equal(pending[0]?.decisionHash, null);
    },
  );

  for (const kind of ["config", "evidence", "decision", "snapshot"] as const) {
    for (const hash of [null, "f".repeat(64)]) {
      check(
        `refuses ${hash === null ? "missing" : "mismatched"} ${kind} hash before a chain send`,
        async (db) => {
          const community = randomAddress();
          const seed = await seedReadyEpoch(db, { now: NOW, chainAddress: community });
          if (kind === "config") {
            await db
              .update(rewardConfigs)
              .set({ configHash: hash })
              .where(eq(rewardConfigs.communityId, seed.communityId));
          } else if (kind === "evidence") {
            await db
              .update(rewardIntakes)
              .set({ evidenceHash: hash })
              .where(eq(rewardIntakes.epochId, seed.epochId));
          } else if (kind === "decision") {
            await db
              .update(rewardDecisions)
              .set({ decisionHash: hash })
              .where(eq(rewardDecisions.epochId, seed.epochId));
          } else {
            await db
              .update(rewardSnapshotEntries)
              .set({ decisionHash: hash })
              .where(eq(rewardSnapshotEntries.memberId, seed.members.floor));
          }
          let sends = 0;
          const chain: PublishChain = {
            network: SETTINGS.network,
            programId: SETTINGS.programId,
            readCommunity: async () => ({
              address: community,
              feeRecipient: SETTINGS.feeRecipient,
            }),
            readEpoch: async () => null,
            publishEpoch: async () => {
              sends += 1;
              return "unexpected";
            },
            publishSignature: async () => "unexpected",
          };
          await assert.rejects(
            () => publishEpoch(db, chain, { ...seed, grossLamports: SETTINGS.grossLamports }),
            hash === null ? /missing stored .* hash/ : /stored .* hash mismatch/,
          );
          assert.equal(sends, 0);
          if (hash !== null) {
            await assert.rejects(
              () => backfillEpochCommitments(db, seed),
              /stored .* hash mismatch/,
            );
          }
        },
      );
    }
  }

  check("rejects a snapshot mismatch without filling any other hashes", async (db) => {
    const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    await db
      .update(rewardSnapshotEntries)
      .set({ decisionHash: "f".repeat(64) })
      .where(eq(rewardSnapshotEntries.memberId, seed.members.floor));
    await assert.rejects(() => backfillEpochCommitments(db, seed), /stored snapshot hash mismatch/);
    const rows = await db
      .select()
      .from(rewardConfigs)
      .where(eq(rewardConfigs.communityId, seed.communityId));
    assert.equal(rows[0]?.configHash, null);
    const decisions = await db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.epochId, seed.epochId));
    assert.ok(decisions.every((d) => d.decisionHash === null));
  });

  check(
    "refuses changed decision content instead of replacing its stored commitment",
    async (db) => {
      const seed = await seedReadyEpoch(db, { now: NOW });
      await db
        .update(rewardDecisions)
        .set({ explanation: "changed after commitment" })
        .where(eq(rewardDecisions.epochId, seed.epochId));
      await assert.rejects(
        () => backfillEpochCommitments(db, seed),
        /stored decision hash mismatch/,
      );
      await assert.rejects(
        () => buildPublication(db, seed, SETTINGS),
        /stored decision hash mismatch/,
      );
    },
  );

  check("refuses a gap in predecessor revision order", async (db) => {
    const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    const rows = await db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.epochId, seed.epochId));
    const upgrade = rows.find((d) => d.revision === 2);
    assert.ok(upgrade);
    await db.update(rewardDecisions).set({ revision: 4 }).where(eq(rewardDecisions.id, upgrade.id));
    await assert.rejects(() => backfillEpochCommitments(db, seed), /lineage/);
  });

  check("refuses a decision whose dispatch is still pending reconciliation", async (db) => {
    const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    await db
      .update(rewardDispatches)
      .set({ state: "pending_reconciliation" })
      .where(eq(rewardDispatches.communityId, seed.communityId));
    await assert.rejects(() => backfillEpochCommitments(db, seed), /no completed dispatch/);
  });

  check("database constraints reject malformed hashes", async (db) => {
    const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    for (const value of ["", "A".repeat(64), "a".repeat(63), "a".repeat(65)]) {
      await assert.rejects(
        () =>
          db
            .update(rewardConfigs)
            .set({ configHash: value })
            .where(eq(rewardConfigs.communityId, seed.communityId)),
        (error: unknown) => (error as { cause?: { code?: string } }).cause?.code === "23514",
      );
    }
  });

  check("refuses a community/epoch mismatch without filling hashes", async (db) => {
    const first = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    const second = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    await assert.rejects(
      () =>
        backfillEpochCommitments(db, { communityId: second.communityId, epochId: first.epochId }),
      /not in community/,
    );
  });

  check("backfill leaves a recorded published root and transaction unchanged", async (db) => {
    const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    const root = "a".repeat(64);
    await db
      .update(epochs)
      .set({ root, status: "published", publishTx: "existing-publication" })
      .where(eq(epochs.id, seed.epochId));
    await backfillEpochCommitments(db, seed);
    const [row] = await db.select().from(epochs).where(eq(epochs.id, seed.epochId));
    assert.equal(row?.root, root);
    assert.equal(row?.publishTx, "existing-publication");
    assert.equal(row?.status, "published");
  });
}
