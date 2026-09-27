import {
  type Db,
  epochs,
  rewardConfigs,
  rewardDecisions,
  rewardEpochSnapshots,
  rewardIntakes,
  rewardSnapshotEntries,
} from "@hyphae/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { withCommunityLock } from "../rewards/config.js";
import { type EpochCommitments, epochCommitments } from "./commitments.js";

interface HashRow {
  id: string;
  stored: string | null;
  expected: string | null;
}

async function hashRows(tx: Db, epochId: string, computed: EpochCommitments) {
  const configs = await tx
    .select()
    .from(rewardConfigs)
    .where(inArray(rewardConfigs.id, [...computed.configHashes.keys()]));
  const intakes = await tx.select().from(rewardIntakes).where(eq(rewardIntakes.epochId, epochId));
  const decisions = await tx
    .select()
    .from(rewardDecisions)
    .where(eq(rewardDecisions.epochId, epochId))
    .orderBy(asc(rewardDecisions.contributionId), asc(rewardDecisions.revision));
  const entries = await tx
    .select({ entry: rewardSnapshotEntries })
    .from(rewardSnapshotEntries)
    .innerJoin(rewardEpochSnapshots, eq(rewardEpochSnapshots.id, rewardSnapshotEntries.snapshotId))
    .where(eq(rewardEpochSnapshots.epochId, epochId));

  const required = (hash: string | undefined, id: string): string => {
    if (hash === undefined) throw new Error(`commitments: row ${id} has no computed commitment`);
    return hash;
  };
  return {
    config: configs.map(
      (c): HashRow => ({
        id: c.id,
        stored: c.configHash,
        expected: required(computed.configHashes.get(c.id), c.id),
      }),
    ),
    evidence: intakes.map(
      (i): HashRow => ({
        id: i.id,
        stored: i.evidenceHash,
        expected: required(computed.evidence.get(i.contributionId)?.hash, i.id),
      }),
    ),
    decision: decisions.map(
      (d): HashRow => ({
        id: d.id,
        stored: d.decisionHash,
        expected: required(computed.decisions.get(d.id)?.hash, d.id),
      }),
    ),
    snapshot: entries.map(({ entry: e }): HashRow => {
      const selected = e.decisionId ? computed.decisions.get(e.decisionId) : undefined;
      const evidence = computed.evidence.get(e.contributionId);
      if (
        !evidence ||
        evidence.payload.member_id !== e.memberId ||
        (e.decisionId !== null &&
          (!selected ||
            selected.payload.contribution_id !== e.contributionId ||
            selected.payload.revision !== e.revision?.toString()))
      ) {
        throw new Error(`commitments: snapshot entry ${e.id} has an invalid selected decision`);
      }
      return { id: e.id, stored: e.decisionHash, expected: selected?.hash ?? null };
    }),
  };
}

function verify(rows: Awaited<ReturnType<typeof hashRows>>, allowMissing: boolean): void {
  for (const [kind, group] of Object.entries(rows)) {
    for (const row of group) {
      if (row.stored === null && row.expected !== null) {
        if (!allowMissing) throw new Error(`commitments: missing stored ${kind} hash ${row.id}`);
      } else if (row.stored !== row.expected) {
        throw new Error(`commitments: stored ${kind} hash mismatch ${row.id}`);
      }
    }
  }
}

// Called within publication's repeatable-read transaction. Never repairs or fills on the read path.
export async function storedEpochCommitments(tx: Db, epochId: string): Promise<EpochCommitments> {
  const computed = await epochCommitments(tx, epochId);
  verify(await hashRows(tx, epochId, computed), false);
  return computed;
}

export interface BackfillCounts {
  configs: number;
  evidence: number;
  decisions: number;
  snapshots: number;
}

// Explicit, per-epoch B6 backfill. The existing reward-writer lock also excludes close/corrections;
// a mismatch aborts the transaction rather than rewriting a previously stored commitment.
export async function backfillEpochCommitments(
  db: Db,
  ref: { communityId: string; epochId: string },
): Promise<BackfillCounts> {
  return withCommunityLock(db, ref.communityId, {}, async (tx) => {
    const [epoch] = await tx
      .select()
      .from(epochs)
      .where(and(eq(epochs.id, ref.epochId), eq(epochs.communityId, ref.communityId)));
    if (!epoch)
      throw new Error(`commitments: epoch ${ref.epochId} is not in community ${ref.communityId}`);
    const computed = await epochCommitments(tx, epoch.id);
    const rows = await hashRows(tx, epoch.id, computed);
    verify(rows, true);

    const fill = async (
      group: HashRow[],
      update: (id: string, hash: string) => Promise<unknown>,
    ) => {
      let count = 0;
      for (const row of group) {
        if (row.stored === null && row.expected !== null) {
          await update(row.id, row.expected);
          count += 1;
        }
      }
      return count;
    };
    const counts: BackfillCounts = {
      configs: await fill(rows.config, async (id, hash) =>
        tx
          .update(rewardConfigs)
          .set({ configHash: hash })
          .where(and(eq(rewardConfigs.id, id), isNull(rewardConfigs.configHash))),
      ),
      evidence: await fill(rows.evidence, async (id, hash) =>
        tx
          .update(rewardIntakes)
          .set({ evidenceHash: hash })
          .where(and(eq(rewardIntakes.id, id), isNull(rewardIntakes.evidenceHash))),
      ),
      decisions: await fill(rows.decision, async (id, hash) =>
        tx
          .update(rewardDecisions)
          .set({ decisionHash: hash })
          .where(and(eq(rewardDecisions.id, id), isNull(rewardDecisions.decisionHash))),
      ),
      snapshots: await fill(rows.snapshot, async (id, hash) =>
        tx
          .update(rewardSnapshotEntries)
          .set({ decisionHash: hash })
          .where(and(eq(rewardSnapshotEntries.id, id), isNull(rewardSnapshotEntries.decisionHash))),
      ),
    };
    verify(await hashRows(tx, epoch.id, computed), false);
    return counts;
  });
}
