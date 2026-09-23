import {
  type Db,
  epochs,
  rewardConfigs,
  rewardDispatches,
  rewardIntakes,
  rewardNominations,
  rewardRetrievals,
} from "@hyphae/db";
import { and, desc, eq, gt, inArray, lte, ne, notExists, sql } from "drizzle-orm";
import { RewardConfigPayload } from "./config.js";
import type { EvaluationTarget } from "./evaluation.js";

export interface StrandedWork {
  evaluations: { communityId: string; target: EvaluationTarget }[];
  retrievals: { communityId: string; nominationId: string; round: number }[];
}

const one = sql`1`;

// A queue insert runs after its database commit, so a crash or a failed send can strand work
// that the database says is waiting. This finds it; re-queueing is safe because every job
// re-checks under the community lock and the dispatch and retrieval rows are the idempotency.
// Work younger than `graceMs` is skipped so the sweep does not race the job its caller queued.
export async function strandedWork(
  db: Db,
  input: { now: Date; graceMs: number },
): Promise<StrandedWork> {
  const settled = new Date(input.now.getTime() - input.graceMs);

  const intakes = await db
    .select({
      communityId: rewardIntakes.communityId,
      contributionId: rewardIntakes.contributionId,
    })
    .from(rewardIntakes)
    .innerJoin(epochs, eq(epochs.id, rewardIntakes.epochId))
    .where(
      and(
        gt(epochs.closesAt, input.now),
        lte(rewardIntakes.acceptedAt, settled),
        // Every decision descends from a live quality dispatch or a live new-work nomination,
        // so these two checks also exclude decided work.
        notExists(
          db
            .select({ one })
            .from(rewardDispatches)
            .where(
              and(
                eq(rewardDispatches.contributionId, rewardIntakes.contributionId),
                eq(rewardDispatches.purpose, "quality"),
                ne(rewardDispatches.state, "not_sent_proven"),
              ),
            ),
        ),
        notExists(
          db
            .select({ one })
            .from(rewardNominations)
            .where(
              and(
                eq(rewardNominations.contributionId, rewardIntakes.contributionId),
                eq(rewardNominations.kind, "new_work"),
                ne(rewardNominations.state, "withdrawn"),
              ),
            ),
        ),
      ),
    );

  // A nomination whose slot has a live dispatch is owned by that dispatch; this includes a
  // model-reported evidence gap, whose spent dispatch must not trigger retrieval.
  const noLiveSlotDispatch = notExists(
    db
      .select({ one })
      .from(rewardDispatches)
      .where(
        and(
          eq(rewardDispatches.slotId, rewardNominations.slotId),
          ne(rewardDispatches.state, "not_sent_proven"),
        ),
      ),
  );
  const nominations = await db
    .select({
      id: rewardNominations.id,
      communityId: rewardNominations.communityId,
      contributionId: rewardNominations.contributionId,
      epochId: rewardNominations.epochId,
      state: rewardNominations.state,
      payload: rewardConfigs.payload,
    })
    .from(rewardNominations)
    .innerJoin(epochs, eq(epochs.id, rewardNominations.epochId))
    .innerJoin(rewardIntakes, eq(rewardIntakes.id, rewardNominations.intakeId))
    .innerJoin(rewardConfigs, eq(rewardConfigs.id, rewardIntakes.configId))
    .where(
      and(
        inArray(rewardNominations.state, ["ready", "pending_evidence"]),
        gt(epochs.closesAt, input.now),
        lte(rewardNominations.updatedAt, settled),
        noLiveSlotDispatch,
      ),
    );

  // A dispatch still `dispatched` past the grace lost its in-flight recheck; the re-run moves it to
  // reconciliation without a call, even after the epoch closed.
  const stale = await db
    .select({
      communityId: rewardDispatches.communityId,
      contributionId: rewardDispatches.contributionId,
      nominationId: rewardDispatches.nominationId,
    })
    .from(rewardDispatches)
    .where(
      and(eq(rewardDispatches.state, "dispatched"), lte(rewardDispatches.dispatchedAt, settled)),
    );

  // Recording a round also touches the nomination, so the grace on updatedAt covers the round.
  const retrievals: StrandedWork["retrievals"] = [];
  for (const n of nominations.filter((row) => row.state === "pending_evidence")) {
    const [last] = await db
      .select({ round: rewardRetrievals.round })
      .from(rewardRetrievals)
      .where(
        and(
          eq(rewardRetrievals.contributionId, n.contributionId),
          eq(rewardRetrievals.epochId, n.epochId),
        ),
      )
      .orderBy(desc(rewardRetrievals.round))
      .limit(1);
    const { retrievalRounds } = RewardConfigPayload.parse(n.payload).effort;
    if (last && last.round < retrievalRounds) {
      retrievals.push({ communityId: n.communityId, nominationId: n.id, round: last.round + 1 });
    }
  }

  return {
    evaluations: [
      ...intakes.map((i) => ({
        communityId: i.communityId,
        target: { contributionId: i.contributionId },
      })),
      ...nominations
        .filter((n) => n.state === "ready")
        .map((n) => ({ communityId: n.communityId, target: { nominationId: n.id } })),
      ...stale.map((d) => ({
        communityId: d.communityId,
        target: d.nominationId
          ? { nominationId: d.nominationId }
          : { contributionId: d.contributionId },
      })),
    ],
    retrievals,
  };
}
