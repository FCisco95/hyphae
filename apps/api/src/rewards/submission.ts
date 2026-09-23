import type { Db } from "@hyphae/db";
import { latestEpoch, type RewardDeps } from "./config.js";
import { type AdmitInput, type AdmitResult, admitContribution } from "./intake.js";
import { type NominateResult, nominate } from "./slots.js";

export type RoutedSubmission = { lane: "legacy" } | { lane: "reward"; result: AdmitResult };

// A community without reward epochs keeps the legacy /submit path until its separate cutover.
export async function routeSubmission(
  db: Db,
  input: AdmitInput,
  deps: RewardDeps = {},
): Promise<RoutedSubmission> {
  if (!(await latestEpoch(db, input.communityId))) return { lane: "legacy" };
  return { lane: "reward", result: await admitContribution(db, input, deps) };
}

export interface EffortResult {
  admit: AdmitResult;
  nominate?: NominateResult;
}

// /effort: admit the artifact (or find it already admitted), then nominate it explicitly.
export async function submitEffort(
  db: Db,
  input: { admit: AdmitInput; nominationKey: string },
  deps: RewardDeps = {},
): Promise<EffortResult> {
  const admit = await admitContribution(db, input.admit, deps);
  if (admit.status !== "admitted" && admit.status !== "duplicate_artifact") return { admit };
  const result = await nominate(
    db,
    {
      communityId: input.admit.communityId,
      memberId: input.admit.memberId,
      contributionId: admit.intake.contributionId,
      idempotencyKey: input.nominationKey,
    },
    deps,
  );
  return { admit, nominate: result };
}
