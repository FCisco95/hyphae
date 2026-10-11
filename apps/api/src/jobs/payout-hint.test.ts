import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeModel } from "../http/demo-seed.js";
import { runEvaluation } from "../rewards/evaluation.js";
import { createTestDb, later, seedRewardLane } from "../rewards/test-db.js";
import { lockScoreMessages } from "./payout-hint.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});
const MIN = 60_000;
// A paid epoch 1; its member has only a pasted wallet and no rules test pass.
async function paidLane(firstPaidEpoch: number | null = 1) {
  const lane = await seedRewardLane(t.db);
  await t.db
    .update(communities)
    .set({ firstPaidEpoch })
    .where(eq(communities.id, lane.community.id));
  const score = async (memberId = lane.member.id, clockMs = 2 * MIN) => {
    const intake = await lane.admitOne(undefined, memberId);
    const r = await runEvaluation(
      t.db,
      { communityId: lane.community.id, target: { contributionId: intake.contributionId } },
      { model: "test:fake", call: fakeModel(85), horizonMs: 5 * MIN, clock: later(clockMs) },
    );
    if (r.status !== "completed") throw new Error(`score: ${r.status}`);
    return r.decision.id;
  };
  return { ...lane, score };
}

describe("lockScoreMessages", () => {
  it("takes the lock of the decision's member and epoch, and refuses an unknown decision", async () => {
    const lane = await paidLane();
    const decision = await lane.score();
    await t.db.transaction((tx) => lockScoreMessages(tx, decision));
    await expect(
      t.db.transaction((tx) => lockScoreMessages(tx, "00000000-0000-4000-8000-000000000000")),
    ).rejects.toThrow(/missing/);
  });
});
