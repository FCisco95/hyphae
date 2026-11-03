// A community with several closed epochs for the settle-loop tests: epoch 1 as seedReadyEpoch
// builds it, then one more closed epoch per entry of `plan`, in which the named members each
// post once and are scored 85. A member of the PAYABLE labels gets a holder result in the window,
// so an epoch with one of them is ready and an epoch with none is blocked by no_payable_members.
import { randomUUID } from "node:crypto";
import { type Db, holdChecks } from "@hyphae/db";
import { fakeModel } from "../http/demo-seed.js";
import { closeEpoch } from "../rewards/close.js";
import { type Clock, latestEpoch } from "../rewards/config.js";
import { type EvaluationTarget, runEvaluation } from "../rewards/evaluation.js";
import { admitContribution } from "../rewards/intake.js";
import { backfillEpochCommitments } from "./commitment-store.js";
import {
  READY_HOLD_THRESHOLD,
  type ReadyLabel,
  type ReadySeed,
  seedReadyEpoch,
} from "./ready-seed.js";

const MIN = 60_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const PAYABLE: ReadonlySet<ReadyLabel> = new Set(["effort", "ordinary", "floor"]);

export interface RolloverSeed extends ReadySeed {
  // Every closed epoch, by index, epoch 1 first.
  epochs: { id: string; index: number; closesAt: Date }[];
}

// The last epoch closes two days before `now`, so its hold window is over at `now`.
export async function seedRolloverLane(
  db: Db,
  opts: { now: Date; chainAddress: string; plan: readonly (readonly ReadyLabel[])[] },
): Promise<RolloverSeed> {
  const weeks = opts.plan.length + 1;
  const t0 = new Date(opts.now.getTime() - weeks * WEEK - 2 * DAY);
  const seed = await seedReadyEpoch(db, {
    now: new Date(t0.getTime() + 8 * DAY),
    chainAddress: opts.chainAddress,
  });
  const { communityId, mint } = seed;
  const epochs: RolloverSeed["epochs"] = [{ id: seed.epochId, index: 1, closesAt: seed.closesAt }];
  const at =
    (when: Date): Clock =>
    async () =>
      when;
  const suffix = randomUUID().slice(0, 8);
  let seq = 100;

  for (const labels of opts.plan) {
    const epoch = await latestEpoch(db, communityId);
    if (!epoch || epoch.status !== "open") throw new Error("rollover: no open epoch to fill");
    for (const label of labels) {
      seq += 1;
      const when = new Date(epoch.opensAt.getTime() + seq * MIN);
      const admitted = await admitContribution(
        db,
        {
          communityId,
          memberId: seed.members[label],
          contribution: {
            kind: "post",
            url: `https://x.com/rollover/status/${suffix}${seq}`,
            text: `Rollover contribution ${seq}: a specific reply to the raid post.`,
            oembed: null,
            telegramMessageId: seq,
          },
          artifactKey: `rollover:${suffix}:${seq}`,
          idempotencyKey: `rollover:${suffix}:${seq}`,
          capture: { source: "x_oembed", capturedAt: when.toISOString(), limitations: [] },
        },
        { clock: at(when) },
      );
      if (admitted.status !== "admitted") throw new Error(`rollover: admit ${admitted.status}`);
      const target: EvaluationTarget = { contributionId: admitted.intake.contributionId };
      const evaluated = await runEvaluation(
        db,
        { communityId, target },
        {
          model: "rollover:fake-model",
          call: fakeModel(85),
          horizonMs: 5 * MIN,
          clock: at(new Date(when.getTime() + MIN)),
        },
      );
      if (evaluated.status !== "completed") {
        throw new Error(`rollover: evaluate ${evaluated.status}`);
      }
    }
    const closed = await closeEpoch(
      db,
      { communityId, epochId: epoch.id },
      { clock: at(new Date(epoch.closesAt.getTime() + MIN)) },
    );
    if (closed.status !== "closed") throw new Error("rollover: close");
    const observedAt = new Date(epoch.closesAt.getTime() + 5 * MIN);
    for (const label of new Set(labels)) {
      if (!PAYABLE.has(label)) continue;
      await db.insert(holdChecks).values({
        communityId,
        epochId: epoch.id,
        memberId: seed.members[label],
        wallet: seed.wallets[label],
        mint,
        thresholdRaw: READY_HOLD_THRESHOLD,
        checkRound: randomUUID(),
        status: "holder",
        attempts: 1,
        rawAmount: "150000000000",
        decimals: 6,
        provider: "consensus",
        slot: "412345678",
        observedAt,
        checkedAt: observedAt,
      });
    }
    await backfillEpochCommitments(db, { communityId, epochId: epoch.id });
    epochs.push({ id: epoch.id, index: epoch.index, closesAt: epoch.closesAt });
  }
  return { ...seed, epochs };
}
