import { type Db, rewardIntakes } from "@hyphae/db";
import { and, eq, isNull } from "drizzle-orm";
import { latestEpoch, type RewardDeps } from "./config.js";
import {
  type AdmitInput,
  type AdmitResult,
  admitContribution,
  type RewardIntake,
} from "./intake.js";
import { type NominateResult, nominate } from "./slots.js";

export type RoutedSubmission = { lane: "legacy" } | { lane: "reward"; result: AdmitResult };

// A community without reward epochs keeps the legacy /submit path until its separate cutover.
export const hasRewardLane = async (db: Db, communityId: string): Promise<boolean> =>
  (await latestEpoch(db, communityId)) !== undefined;

export async function routeSubmission(
  db: Db,
  input: AdmitInput,
  deps: RewardDeps = {},
): Promise<RoutedSubmission> {
  if (!(await hasRewardLane(db, input.communityId))) return { lane: "legacy" };
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

// Lets /effort nominate already admitted work without repeating the submission preflight. The
// original intake stands for the artifact; nominate() follows it to any later re-entry.
export async function admittedIntake(
  db: Db,
  communityId: string,
  artifactKey: string,
): Promise<RewardIntake | undefined> {
  const [row] = await db
    .select()
    .from(rewardIntakes)
    .where(
      and(
        eq(rewardIntakes.communityId, communityId),
        eq(rewardIntakes.artifactKey, artifactKey),
        isNull(rewardIntakes.reentryOf),
      ),
    );
  return row;
}
