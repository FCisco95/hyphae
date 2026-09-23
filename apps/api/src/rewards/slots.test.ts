import {
  members,
  rewardDecisions,
  rewardDispatches,
  rewardNominations,
  rewardRetrievals,
  rewardSlots,
} from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapRewardEpochs, buildRewardConfigPayload } from "./config.js";
import { admitContribution, type Capture } from "./intake.js";
import { nominate, withdrawNomination } from "./slots.js";
import { at, createTestDb, rubric, seedCommunity } from "./test-db.js";

const T0 = new Date("2026-10-01T00:00:00.000Z");
const WEEK_MS = 7 * 86_400_000;
const later = (ms: number) => at(new Date(T0.getTime() + ms));

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const textOnly: Capture = { source: "x_oembed", capturedAt: T0.toISOString(), limitations: [] };
const withMedia: Capture = { ...textOnly, limitations: ["media_not_captured"] };

let seq = 0;
async function setup() {
  const { community, member } = await seedCommunity(t.db);
  await bootstrapRewardEpochs(
    t.db,
    {
      communityId: community.id,
      payload: buildRewardConfigPayload(rubric),
      opensAt: T0,
      proposedBy: "test",
    },
    { clock: later(-3600_000) },
  );
  const admitOne = async (capture: Capture = textOnly, memberId = member.id) => {
    seq += 1;
    const result = await admitContribution(
      t.db,
      {
        communityId: community.id,
        memberId,
        contribution: {
          kind: "post",
          url: `https://x.com/a/status/${seq}`,
          text: `work ${seq}`,
          oembed: null,
          telegramMessageId: seq,
        },
        artifactKey: `x:status:${seq}`,
        idempotencyKey: `tg:-1:${seq}`,
        capture,
      },
      { clock: later(60_000) },
    );
    if (result.status !== "admitted") throw new Error(`admit: ${result.status}`);
    return result.intake;
  };
  const nom = (contributionId: string, key: string, clockMs = 120_000) =>
    nominate(
      t.db,
      { communityId: community.id, memberId: member.id, contributionId, idempotencyKey: key },
      { clock: later(clockMs) },
    );
  const withdraw = (nominationId: string) =>
    withdrawNomination(
      t.db,
      { communityId: community.id, memberId: member.id, nominationId },
      { clock: later(180_000) },
    );
  return { community, member, admitOne, nom, withdraw };
}

async function insertDecision(
  intake: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["admitOne"]>>,
  effort: "eligible" | "ineligible" | "not_nominated" = "not_nominated",
) {
  await t.db.insert(rewardDecisions).values({
    communityId: intake.communityId,
    contributionId: intake.contributionId,
    epochId: intake.epochId,
    configId: intake.configId,
    revision: 1,
    rawQuality: 85,
    creditedQuality: 85,
    flags: [],
    effort,
    timingBps: 10_000,
    multiplierBps: 10_000,
    pointUnits: 8_500_000_000n,
    explanation: "ordinary",
    acceptedAt: new Date(T0.getTime() + 90_000),
    affectsAllocation: true,
  });
}

describe("nominate", () => {
  it("reserves slot 1 with the first candidate and records retrieval round 1", async () => {
    const s = await setup();
    const intake = await s.admitOne();
    const result = await s.nom(intake.contributionId, "n1");
    expect(result).toMatchObject({ status: "nominated", created: true, nextRetrievalRound: null });
    if (result.status !== "nominated") return;
    expect(result.nomination).toMatchObject({
      kind: "new_work",
      state: "ready",
      candidateOrdinal: 1,
      pendingReason: null,
    });
    const [slot] = await t.db
      .select()
      .from(rewardSlots)
      .where(eq(rewardSlots.id, result.nomination.slotId));
    expect(slot).toMatchObject({ ordinal: 1, state: "reserved", candidatesUsed: 1 });
    const rounds = await t.db
      .select()
      .from(rewardRetrievals)
      .where(eq(rewardRetrievals.contributionId, intake.contributionId));
    expect(rounds).toMatchObject([{ round: 1, outcome: "complete" }]);
  });

  it("returns the existing nomination for a repeated idempotency key", async () => {
    const s = await setup();
    const intake = await s.admitOne();
    const first = await s.nom(intake.contributionId, "n1");
    const again = await s.nom(intake.contributionId, "n1");
    expect(again).toMatchObject({ status: "nominated", created: false });
    if (first.status !== "nominated" || again.status !== "nominated") return;
    expect(again.nomination.id).toBe(first.nomination.id);
  });

  it("keeps work with uncaptured media pending evidence and schedules round 2", async () => {
    const s = await setup();
    const intake = await s.admitOne(withMedia);
    const result = await s.nom(intake.contributionId, "n1");
    expect(result).toMatchObject({
      status: "nominated",
      nextRetrievalRound: 2,
      nomination: { state: "pending_evidence", pendingReason: "media_not_captured" },
    });
  });

  it("refuses a second artifact while the slot is reserved", async () => {
    const s = await setup();
    const a = await s.admitOne();
    const b = await s.admitOne();
    await s.nom(a.contributionId, "n1");
    expect((await s.nom(b.contributionId, "n2")).status).toBe("slot_in_use");
  });

  it("refuses the same artifact twice while its nomination is live", async () => {
    const s = await setup();
    const a = await s.admitOne();
    await s.nom(a.contributionId, "n1");
    expect((await s.nom(a.contributionId, "n2")).status).toBe("already_nominated");
  });

  it("allows three candidates per slot across withdrawals, never resetting the count", async () => {
    const s = await setup();
    const ids: string[] = [];
    for (let i = 1; i <= 3; i += 1) {
      const intake = await s.admitOne();
      const result = await s.nom(intake.contributionId, `n${i}`);
      if (result.status !== "nominated") throw new Error(result.status);
      expect(result.nomination.candidateOrdinal).toBe(i);
      ids.push(result.nomination.id);
      expect((await s.withdraw(result.nomination.id)).status).toBe("withdrawn");
    }
    const fourth = await s.admitOne();
    expect((await s.nom(fourth.contributionId, "n4")).status).toBe("candidates_exhausted");
    const [slot] = await t.db
      .select()
      .from(rewardSlots)
      .innerJoin(rewardNominations, eq(rewardNominations.slotId, rewardSlots.id))
      .where(eq(rewardNominations.id, ids[0] as string));
    expect(slot?.reward_slots).toMatchObject({ state: "open", candidatesUsed: 3, generation: 3 });
  });

  it("does not record round 1 again when a withdrawn artifact is nominated again", async () => {
    const s = await setup();
    const intake = await s.admitOne(withMedia);
    const first = await s.nom(intake.contributionId, "n1");
    if (first.status !== "nominated") throw new Error(first.status);
    await s.withdraw(first.nomination.id);
    const second = await s.nom(intake.contributionId, "n2");
    expect(second).toMatchObject({ status: "nominated", nomination: { candidateOrdinal: 2 } });
    const rounds = await t.db
      .select()
      .from(rewardRetrievals)
      .where(eq(rewardRetrievals.contributionId, intake.contributionId));
    expect(rounds).toHaveLength(1);
  });

  it("upgrades a completed ordinary contribution", async () => {
    const s = await setup();
    const intake = await s.admitOne();
    await insertDecision(intake);
    expect(await s.nom(intake.contributionId, "n1")).toMatchObject({
      status: "nominated",
      nomination: { kind: "upgrade", state: "ready" },
    });
  });

  it("refuses while the ordinary quality evaluation is in flight", async () => {
    const s = await setup();
    const intake = await s.admitOne();
    await t.db.insert(rewardDispatches).values({
      communityId: intake.communityId,
      contributionId: intake.contributionId,
      purpose: "quality",
      fence: 1,
      idempotencyKey: `quality:${intake.contributionId}:1`,
      state: "dispatched",
      model: "test:fake",
      promptVersion: "reward-eval/1",
      promptHash: "h",
      inputHash: "i",
      input: {},
      dispatchedAt: T0,
    });
    expect((await s.nom(intake.contributionId, "n1")).status).toBe("quality_pending");
  });

  it("refuses an upgrade once the origin epoch has closed", async () => {
    const s = await setup();
    const intake = await s.admitOne();
    await insertDecision(intake);
    expect((await s.nom(intake.contributionId, "n1", WEEK_MS)).status).toBe("epoch_closed");
  });

  it("refuses work whose effort was already judged", async () => {
    const s = await setup();
    const intake = await s.admitOne();
    await insertDecision(intake, "ineligible");
    expect((await s.nom(intake.contributionId, "n1")).status).toBe("already_effort");
  });

  it("refuses another member's contribution", async () => {
    const s = await setup();
    const [other] = await t.db
      .insert(members)
      .values({
        communityId: s.community.id,
        telegramUserId: 99n,
        wallet: `Other${seq}`,
        linkMethod: "paste",
      })
      .returning();
    if (!other) throw new Error("seed other");
    const theirs = await s.admitOne(textOnly, other.id);
    expect((await s.nom(theirs.contributionId, "n1")).status).toBe("not_yours");
  });

  it("refuses once every slot is consumed", async () => {
    const s = await setup();
    const a = await s.admitOne();
    const first = await s.nom(a.contributionId, "n1");
    if (first.status !== "nominated") throw new Error(first.status);
    await t.db
      .update(rewardSlots)
      .set({ state: "consumed" })
      .where(eq(rewardSlots.id, first.nomination.slotId));
    const b = await s.admitOne();
    expect((await s.nom(b.contributionId, "n2")).status).toBe("slot_used");
  });
});

describe("withdrawNomination", () => {
  it("refuses once a dispatch may have been sent", async () => {
    const s = await setup();
    const a = await s.admitOne();
    const result = await s.nom(a.contributionId, "n1");
    if (result.status !== "nominated") throw new Error(result.status);
    await t.db
      .update(rewardNominations)
      .set({ state: "evaluating" })
      .where(eq(rewardNominations.id, result.nomination.id));
    expect((await s.withdraw(result.nomination.id)).status).toBe("dispatched");
  });
});
