import type { Rubric } from "@hyphae/core";
import { communities, type Db } from "@hyphae/db";
import { eq } from "drizzle-orm";
import {
  bootstrapRewardEpochs,
  buildRewardConfigPayload,
  type Epoch,
  latestEpoch,
  proposeRewardConfig,
  type RewardConfig,
  type RewardDeps,
  type RewardProposal,
} from "./config.js";

export type StageResult =
  | { kind: "bootstrapped"; config: RewardConfig; epoch: Epoch }
  | { kind: "proposed"; proposal: RewardProposal }
  | { kind: "staged_only" };

// The reward write comes first and shares the transaction with the staging update, so a refused
// bootstrap or a no-op proposal leaves the staging rubric (still read by the legacy path) as it was.
export async function stageRubric(
  db: Db,
  input: { communityId: string; rubric: Rubric; activateAt?: Date; proposedBy: string },
  deps: RewardDeps = {},
): Promise<StageResult> {
  return db.transaction(async (tx) => {
    const payload = buildRewardConfigPayload(input.rubric);
    const { communityId, proposedBy } = input;
    let result: StageResult;
    if (input.activateAt) {
      const booted = await bootstrapRewardEpochs(
        tx,
        { communityId, payload, opensAt: input.activateAt, proposedBy },
        deps,
      );
      result = { kind: "bootstrapped", config: booted.config, epoch: booted.epoch };
    } else if (await latestEpoch(tx, communityId)) {
      const proposal = await proposeRewardConfig(tx, { communityId, payload, proposedBy }, deps);
      result = { kind: "proposed", proposal };
    } else {
      result = { kind: "staged_only" };
    }
    await tx
      .update(communities)
      .set({ rubric: input.rubric, rubricVersion: input.rubric.version })
      .where(eq(communities.id, communityId));
    return result;
  });
}
