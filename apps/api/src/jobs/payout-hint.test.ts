import { communities, members, rulesTestPasses } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeModel, seedSignedLink } from "../http/demo-seed.js";
import { beginDispatch, completeDispatch, runEvaluation } from "../rewards/evaluation.js";
import { markNotified } from "../rewards/recovery.js";
import { createTestDb, later, seedRewardLane, T0 } from "../rewards/test-db.js";
import { scoreHint } from "./payout-hint.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const MIN = 60_000;
const WEEK = 7 * 86_400_000;
const during = new Date(T0.getTime() + 10 * MIN);
const notYet = {
  status: "not_payable",
  reasons: ["no_verified_wallet", "no_rules_test"],
  hold: "at_close",
};

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

describe("scoreHint", () => {
  it("is the member's payout status on their first scored message of the epoch, and never again", async () => {
    const lane = await paidLane();
    const first = await lane.score();
    const second = await lane.score();
    expect(await scoreHint(t.db, first, during)).toEqual(notYet);
    // Until the first message is out, the second could still be the first one sent.
    expect(await scoreHint(t.db, second, during)).toEqual(notYet);
    await markNotified(t.db, first, during);
    expect(await scoreHint(t.db, second, during)).toBeNull();
  });

  it("counts only this member's messages in this epoch", async () => {
    const lane = await paidLane();
    const [other] = await t.db
      .insert(members)
      .values({ communityId: lane.community.id, telegramUserId: 99n, linkedAt: null })
      .returning();
    if (!other) throw new Error("seed: member");
    await markNotified(t.db, await lane.score(other.id), during);
    expect(await scoreHint(t.db, await lane.score(), during)).toEqual(notYet);
  });

  it("reports a member with wallet and rules test done as held, which no link can change", async () => {
    const lane = await paidLane();
    const wallet = `HintWallet${lane.community.id.slice(0, 8)}`;
    const [ready] = await t.db
      .insert(members)
      .values({
        communityId: lane.community.id,
        telegramUserId: 98n,
        wallet,
        linkMethod: "signature",
      })
      .returning();
    if (!ready) throw new Error("seed: member");
    await seedSignedLink(t.db, {
      communityId: lane.community.id,
      memberId: ready.id,
      telegramUserId: 98n,
      wallet,
      tokenDigest: `hint-${lane.community.id}`,
      linkedAt: T0,
    });
    await t.db.insert(rulesTestPasses).values({
      communityId: lane.community.id,
      memberId: ready.id,
      testId: "mycel-rules-1",
      passedAt: T0,
    });
    expect(await scoreHint(t.db, await lane.score(ready.id), during)).toEqual({
      status: "held",
      reasons: ["hold_pending"],
      hold: "at_close",
    });
  });

  it("is null once the epoch has closed, for a late decision, and in an epoch that pays no one", async () => {
    const lane = await paidLane();
    const decision = await lane.score();
    expect(await scoreHint(t.db, decision, new Date(T0.getTime() + WEEK))).toBeNull();
    // Begun before the close, completed after it: accepted late, so it changes nothing.
    const intake = await lane.admitOne();
    const begun = await beginDispatch(
      t.db,
      {
        communityId: lane.community.id,
        target: { contributionId: intake.contributionId },
        model: "test:fake",
      },
      { clock: later(2 * MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    const late = await completeDispatch(
      t.db,
      {
        communityId: lane.community.id,
        dispatchId: begun.dispatch.id,
        fence: begun.dispatch.fence,
        output: (await fakeModel(85)(null, "quality")).output,
        latencyMs: 5,
        costMicroUsd: 100,
      },
      { clock: later(WEEK + MIN) },
    );
    if (late.status !== "completed") throw new Error(late.status);
    expect(await scoreHint(t.db, late.decision.id, during)).toBeNull();
    const unpaid = await paidLane(null);
    expect(await scoreHint(t.db, await unpaid.score(), during)).toBeNull();
  });
});
