import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import {
  communities,
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
import { appendCorrection } from "../rewards/decisions.js";
import { at, createTestDb } from "../rewards/test-db.js";
import { backfillEpochCommitments, storedEpochCommitments } from "./commitment-store.js";
import { epochCommitments } from "./commitments.js";
import { buildPublication } from "./publication.js";
import { type OnChainEpoch, type PublishChain, publishEpoch } from "./publish.js";
import { type ReadySeed, randomAddress, seedReadyEpoch } from "./ready-seed.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SETTINGS = {
  network: "solana:devnet" as const,
  programId: HYPHAE_PROGRAM_ID,
  feeRecipient: "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
  grossLamports: 500_000_000n,
};
type HashKind = "config" | "evidence" | "decision" | "snapshot";
const violatesCheck = (error: unknown) =>
  (error as { cause?: { code?: string } }).cause?.code === "23514";

// A chain holding at most one epoch account. With `crashAfterSend`, a send lands on-chain and then
// fails, like a run that stops before recording.
function recordingChain(community: string) {
  let onChain: OnChainEpoch | null = null;
  const state = { sends: 0, crashAfterSend: false };
  const chain: PublishChain = {
    network: SETTINGS.network,
    programId: SETTINGS.programId,
    readCommunity: async () => ({ address: community, feeRecipient: SETTINGS.feeRecipient }),
    readEpoch: async () => onChain,
    publishEpoch: async (input) => {
      state.sends += 1;
      onChain = {
        root: input.root,
        auditHash: input.auditHash,
        grossLamports: input.grossLamports,
        allocatedLamports: input.allocatedLamports,
      };
      if (state.crashAfterSend) throw new Error("crashed after send");
      return "sig-publish";
    },
    publishSignature: async () => "sig-found-on-chain",
  };
  return { chain, state };
}

const publishInput = (seed: ReadySeed) => ({
  communityId: seed.communityId,
  epochId: seed.epochId,
  grossLamports: SETTINGS.grossLamports,
});

function setHash(db: Db, seed: ReadySeed, kind: HashKind, hash: string | null) {
  if (kind === "config") {
    return db
      .update(rewardConfigs)
      .set({ configHash: hash })
      .where(eq(rewardConfigs.communityId, seed.communityId));
  }
  if (kind === "evidence") {
    return db
      .update(rewardIntakes)
      .set({ evidenceHash: hash })
      .where(eq(rewardIntakes.epochId, seed.epochId));
  }
  if (kind === "decision") {
    return db
      .update(rewardDecisions)
      .set({ decisionHash: hash })
      .where(eq(rewardDecisions.epochId, seed.epochId));
  }
  return db
    .update(rewardSnapshotEntries)
    .set({ decisionHash: hash })
    .where(eq(rewardSnapshotEntries.memberId, seed.members.floor));
}

// A correction of the ordinary member's selected work, accepted after the close, so it is
// explanatory only. The lineage is read now; `correct` appends through any pool.
export async function lateCorrection(db: Db, seed: ReadySeed) {
  const [entry] = await db
    .select()
    .from(rewardSnapshotEntries)
    .where(eq(rewardSnapshotEntries.memberId, seed.members.ordinary));
  if (!entry?.decisionId) throw new Error("seed: ordinary member has no selected decision");
  const lineage = await db
    .select()
    .from(rewardDecisions)
    .where(eq(rewardDecisions.contributionId, entry.contributionId))
    .orderBy(asc(rewardDecisions.revision));
  const latest = lineage.at(-1);
  if (!latest) throw new Error("seed: no decision to correct");
  const correct = async (writer: Db) => {
    const result = await appendCorrection(
      writer,
      {
        communityId: seed.communityId,
        contributionId: entry.contributionId,
        expectedRevision: latest.revision,
        changes: { rawQuality: latest.rawQuality === 40 ? 41 : 40 },
        reason: "Operator review after the close.",
        evidenceRefs: ["https://x.com/a/status/1"],
        actor: "script:reward-correct",
        idempotencyKey: `late-${seed.epochId}`,
      },
      { clock: at(NOW) },
    );
    if (result.status !== "appended") throw new Error(`correction ${result.status}`);
    return result.decision;
  };
  return { entry: { ...entry, decisionId: entry.decisionId }, correct };
}

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
      // An entry with no selected decision cannot carry a decision hash.
      await assert.rejects(
        async () =>
          db
            .update(rewardSnapshotEntries)
            .set({ decisionHash: "a".repeat(64) })
            .where(eq(rewardSnapshotEntries.id, pending[0]?.id as string)),
        violatesCheck,
      );
    },
  );

  for (const kind of ["config", "evidence", "decision", "snapshot"] as const) {
    check(`refuses a mismatched ${kind} hash before a chain send`, async (db) => {
      const community = randomAddress();
      const seed = await seedReadyEpoch(db, { now: NOW, chainAddress: community });
      await setHash(db, seed, kind, "f".repeat(64));
      const { chain, state } = recordingChain(community);
      await assert.rejects(
        () => publishEpoch(db, chain, publishInput(seed)),
        new RegExp(`stored ${kind} hash mismatch`),
      );
      assert.equal(state.sends, 0);
      await assert.rejects(() => backfillEpochCommitments(db, seed), /stored .* hash mismatch/);
    });

    check(
      `publication refuses a missing ${kind} hash; the publish job fills it before sending`,
      async (db) => {
        const community = randomAddress();
        const seed = await seedReadyEpoch(db, { now: NOW, chainAddress: community });
        const expected = await buildPublication(db, seed, SETTINGS);
        assert.equal(expected.status, "ready");
        await setHash(db, seed, kind, null);
        await assert.rejects(
          () => buildPublication(db, seed, SETTINGS),
          new RegExp(`missing stored ${kind} hash`),
        );
        const { chain, state } = recordingChain(community);
        const out = await publishEpoch(db, chain, publishInput(seed));
        assert.equal(out.status, "published");
        assert.equal(state.sends, 1);
        if (out.status === "published" && expected.status === "ready") {
          assert.equal(out.root, expected.root);
          assert.equal(out.auditHash, expected.auditHash);
        }
      },
    );
  }

  check("the publish job fills a never-backfilled closed epoch, then publishes", async (db) => {
    const community = randomAddress();
    const seed = await seedReadyEpoch(db, {
      now: NOW,
      chainAddress: community,
      storeCommitments: false,
    });
    const { chain, state } = recordingChain(community);
    const out = await publishEpoch(db, chain, publishInput(seed));
    assert.equal(out.status, "published");
    assert.equal(state.sends, 1);
    assert.deepEqual(
      await storedEpochCommitments(db, seed.epochId),
      await epochCommitments(db, seed.epochId),
    );
  });

  check("the publish job neither fills nor sends for a blocked epoch", async (db) => {
    const community = randomAddress();
    const seed = await seedReadyEpoch(db, {
      now: NOW,
      chainAddress: community,
      storeCommitments: false,
    });
    await db
      .update(communities)
      .set({ firstPaidEpoch: null })
      .where(eq(communities.id, seed.communityId));
    const { chain, state } = recordingChain(community);
    assert.deepEqual(await publishEpoch(db, chain, publishInput(seed)), {
      status: "blocked",
      blockers: ["before_first_paid_epoch"],
    });
    assert.equal(state.sends, 0);
    const decisions = await db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.epochId, seed.epochId));
    assert.ok(decisions.every((d) => d.decisionHash === null));
  });

  check("a late correction must be backfilled and leaves the publication unchanged", async (db) => {
    const seed = await seedReadyEpoch(db, { now: NOW });
    const before = await buildPublication(db, seed, SETTINGS);
    assert.equal(before.status, "ready");
    const late = await lateCorrection(db, seed);
    const correction = await late.correct(db);
    assert.equal(correction.affectsAllocation, false);
    await assert.rejects(
      () => buildPublication(db, seed, SETTINGS),
      /missing stored decision hash/,
    );
    assert.deepEqual(await backfillEpochCommitments(db, seed), {
      configs: 0,
      evidence: 0,
      decisions: 1,
      snapshots: 0,
    });
    assert.deepEqual(await buildPublication(db, seed, SETTINGS), before);
  });

  check(
    "recovers a publish that crashed after its send, even after a late correction",
    async (db) => {
      const community = randomAddress();
      const seed = await seedReadyEpoch(db, { now: NOW, chainAddress: community });
      const { chain, state } = recordingChain(community);
      state.crashAfterSend = true;
      await assert.rejects(() => publishEpoch(db, chain, publishInput(seed)), /crashed/);
      state.crashAfterSend = false;
      await (await lateCorrection(db, seed)).correct(db);
      const out = await publishEpoch(db, chain, publishInput(seed));
      assert.equal(out.status, "published");
      if (out.status !== "published") return;
      assert.equal(out.recovered, true);
      assert.equal(out.signature, "sig-found-on-chain");
      assert.equal(state.sends, 1);
      const [row] = await db.select().from(epochs).where(eq(epochs.id, seed.epochId));
      assert.equal(row?.root, out.root);
      assert.equal(row?.publishTx, "sig-found-on-chain");
    },
  );

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

  check("database constraints reject malformed hashes in every hash column", async (db) => {
    const seed = await seedReadyEpoch(db, { now: NOW, storeCommitments: false });
    for (const kind of ["config", "evidence", "decision", "snapshot"] as const) {
      for (const value of ["", "A".repeat(64), "a".repeat(63), "a".repeat(65)]) {
        await assert.rejects(async () => setHash(db, seed, kind, value), violatesCheck);
      }
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
