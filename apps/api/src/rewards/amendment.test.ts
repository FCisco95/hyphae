import { promptTemplateHash, type RewardPurpose } from "@hyphae/core";
import {
  epochs,
  rewardConfigAmendments,
  rewardConfigs,
  rewardDecisions,
  rewardDispatches,
  rewardIntakes,
} from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { epochCommitments } from "../payout/commitments.js";
import { type AmendInput, admissionConfigId, amendEpochPrompt } from "./amendment.js";
import { closeEpoch } from "./close.js";
import {
  bootstrapRewardEpochs,
  buildRewardConfigPayload,
  materializeEpochs,
  proposeRewardConfig,
  type RewardConfigPayload,
  withCommunityLock,
} from "./config.js";
import { runEvaluation } from "./evaluation.js";
import { admitContribution } from "./intake.js";
import { nominate } from "./slots.js";
import { createTestDb, later, rubric, seedCommunity, T0 } from "./test-db.js";

const MIN = 60_000;
const WEEK_MS = 7 * 86_400_000; // epoch 1 is [T0, T0 + WEEK_MS)
const at = (ms: number) => new Date(T0.getTime() + ms);

// Epoch 2 in production was pinned to reward-eval/1 before reward-eval/2 existed.
const strictPin = (): RewardConfigPayload["scoring"] => ({
  promptVersion: "reward-eval/1",
  promptTemplateHash: promptTemplateHash("reward-eval/1") as string,
});
const basePayload = (): RewardConfigPayload => ({
  ...buildRewardConfigPayload(rubric),
  scoring: strictPin(),
});

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const quality = (score: number) => ({
  score,
  rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "Specific to the post.",
});
const evalDeps = (clockMs: number) => ({
  clock: later(clockMs),
  model: "test:fake",
  horizonMs: 60_000,
  call: async (_prompt: unknown, _purpose: RewardPurpose) => ({
    output: quality(70),
    latencyMs: 5,
    costMicroUsd: 100,
  }),
});

let artifact = 0;
async function lane() {
  const { community, member } = await seedCommunity(t.db);
  const boot = await bootstrapRewardEpochs(
    t.db,
    { communityId: community.id, payload: basePayload(), opensAt: T0, proposedBy: "test" },
    { clock: later(-3_600_000) },
  );
  const admitAt = async (clockMs: number) => {
    artifact += 1;
    const result = await admitContribution(
      t.db,
      {
        communityId: community.id,
        memberId: member.id,
        contribution: {
          kind: "reply",
          url: `https://x.com/a/status/${artifact}`,
          text: `a reply ${artifact}`,
          oembed: null,
          telegramMessageId: artifact,
        },
        artifactKey: `x:status:${artifact}`,
        idempotencyKey: `tg:-1:${artifact}`,
        capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: [] },
      },
      { clock: later(clockMs) },
    );
    if (result.status !== "admitted") throw new Error(`admit: ${result.status}`);
    return result.intake;
  };
  const amend = (over: Partial<AmendInput>, clockMs: number) =>
    amendEpochPrompt(
      t.db,
      {
        communityId: community.id,
        epochIndex: 1,
        promptVersion: "reward-eval/2",
        effectiveAt: at(2 * 3_600_000),
        actor: "Cisco (founder)",
        reason: "Pilot testing phase: scoring is less strict while members learn the rules.",
        ...over,
      },
      { clock: later(clockMs) },
    );
  const score = (contributionId: string, clockMs: number) =>
    runEvaluation(
      t.db,
      { communityId: community.id, target: { contributionId } },
      evalDeps(clockMs),
    );
  return { community, member, epoch: boot.epoch, baseConfig: boot.config, admitAt, amend, score };
}

const EFFECTIVE_MS = 2 * 3_600_000;

describe("amendEpochPrompt: the record", () => {
  it("records actor, reason, times, and the from and to prompt with their template hashes", async () => {
    const l = await lane();
    const row = await l.amend({}, 30 * MIN);

    expect(row).toMatchObject({
      communityId: l.community.id,
      epochId: l.epoch.id,
      fromConfigId: l.baseConfig.id,
      fromPromptVersion: "reward-eval/1",
      fromPromptTemplateHash: promptTemplateHash("reward-eval/1"),
      toPromptVersion: "reward-eval/2",
      toPromptTemplateHash: promptTemplateHash("reward-eval/2"),
      actor: "Cisco (founder)",
      reason: "Pilot testing phase: scoring is less strict while members learn the rules.",
    });
    expect(row.effectiveAt).toEqual(at(EFFECTIVE_MS));
    expect(row.recordedAt).toEqual(at(30 * MIN));
    expect(row.toConfigId).not.toBe(l.baseConfig.id);
  });

  it("changes only the scoring prompt pin: rubric, credit gates, timing, effort and points stay", async () => {
    const l = await lane();
    const row = await l.amend({}, 30 * MIN);
    const [to] = await t.db
      .select({ payload: rewardConfigs.payload })
      .from(rewardConfigs)
      .where(eq(rewardConfigs.id, row.toConfigId));
    if (!to) throw new Error("no amended config");
    const { scoring, ...rest } = to.payload as RewardConfigPayload;
    const { scoring: _base, ...baseRest } = basePayload();
    expect(rest).toEqual(baseRest);
    expect(scoring).toEqual({
      promptVersion: "reward-eval/2",
      promptTemplateHash: promptTemplateHash("reward-eval/2"),
    });
  });

  it("leaves the epoch row on its own configuration", async () => {
    const l = await lane();
    await l.amend({}, 30 * MIN);
    const [epoch] = await t.db.select().from(epochs).where(eq(epochs.id, l.epoch.id));
    expect(epoch?.rewardConfigId).toBe(l.baseConfig.id);
  });
});

describe("amendEpochPrompt: refusals", () => {
  it("refuses an effective time that is not in the future", async () => {
    const l = await lane();
    await expect(l.amend({ effectiveAt: at(30 * MIN) }, 30 * MIN)).rejects.toThrow(/future/);
    await expect(l.amend({ effectiveAt: at(10 * MIN) }, 30 * MIN)).rejects.toThrow(/future/);
    expect(await amendmentsOf(l.community.id)).toHaveLength(0);
  });

  it("refuses an effective time at or after the epoch's close", async () => {
    const l = await lane();
    await expect(l.amend({ effectiveAt: at(WEEK_MS) }, 30 * MIN)).rejects.toThrow(/close/);
  });

  it("refuses an effective time that is not a whole minute, as announced", async () => {
    const l = await lane();
    await expect(l.amend({ effectiveAt: at(EFFECTIVE_MS + 30_000) }, 30 * MIN)).rejects.toThrow(
      /whole minute/,
    );
    await expect(l.amend({ effectiveAt: at(EFFECTIVE_MS + 1) }, 30 * MIN)).rejects.toThrow(
      /whole minute/,
    );
  });

  it("refuses an epoch that is not the one open now", async () => {
    const l = await lane();
    await expect(l.amend({ epochIndex: 2 }, 30 * MIN)).rejects.toThrow(/open/);
    await expect(
      l.amend({ epochIndex: 1, effectiveAt: at(WEEK_MS + 2 * 3_600_000) }, WEEK_MS + MIN),
    ).rejects.toThrow(/open/);
  });

  it("refuses a prompt that is not registered or is already the epoch's", async () => {
    const l = await lane();
    await expect(l.amend({ promptVersion: "reward-eval/9" }, 30 * MIN)).rejects.toThrow(
      /not registered/,
    );
    await expect(l.amend({ promptVersion: "reward-eval/1" }, 30 * MIN)).rejects.toThrow(/already/);
  });

  it("refuses a blank actor or reason", async () => {
    const l = await lane();
    await expect(l.amend({ actor: "  " }, 30 * MIN)).rejects.toThrow(/actor/);
    await expect(l.amend({ reason: "" }, 30 * MIN)).rejects.toThrow(/reason/);
  });

  it("refuses a second amendment of the same epoch", async () => {
    const l = await lane();
    await l.amend({}, 30 * MIN);
    await expect(l.amend({ effectiveAt: at(3 * 3_600_000) }, 40 * MIN)).rejects.toThrow(
      /already amended/,
    );
    expect(await amendmentsOf(l.community.id)).toHaveLength(1);
  });

  it("is refused by the database when effective_at is not after recorded_at", async () => {
    const l = await lane();
    const row = await l.amend({}, 30 * MIN);
    await t.db.delete(rewardConfigAmendments).where(eq(rewardConfigAmendments.id, row.id));
    const { id: _id, ...values } = row;
    await expect(
      t.db.insert(rewardConfigAmendments).values({ ...values, recordedAt: row.effectiveAt }),
    ).rejects.toThrow();
  });
});

describe("admission under an amendment", () => {
  it("pins contributions admitted at or after effective_at to the amended config, earlier ones to the epoch's", async () => {
    const l = await lane();
    const row = await l.amend({}, 30 * MIN);
    const before = await l.admitAt(EFFECTIVE_MS - 1);
    const exactly = await l.admitAt(EFFECTIVE_MS);
    const after = await l.admitAt(EFFECTIVE_MS + MIN);

    expect(before.configId).toBe(l.baseConfig.id);
    expect(exactly.configId).toBe(row.toConfigId);
    expect(after.configId).toBe(row.toConfigId);
  });

  it("scores an amended contribution with the new prompt and an earlier one with the old prompt", async () => {
    const l = await lane();
    const early = await l.admitAt(10 * MIN);
    const row = await l.amend({}, 30 * MIN);
    const late = await l.admitAt(EFFECTIVE_MS + MIN);

    // The early one is scored only after the amendment took effect; its pin still decides.
    const earlyRun = await l.score(early.contributionId, EFFECTIVE_MS + 2 * MIN);
    const lateRun = await l.score(late.contributionId, EFFECTIVE_MS + 3 * MIN);
    if (earlyRun.status !== "completed" || lateRun.status !== "completed") {
      throw new Error("not scored");
    }
    expect(earlyRun.decision.configId).toBe(l.baseConfig.id);
    expect(lateRun.decision.configId).toBe(row.toConfigId);
    const [earlyDispatch] = await dispatchesOf(early.contributionId);
    const [lateDispatch] = await dispatchesOf(late.contributionId);
    expect(earlyDispatch?.promptVersion).toBe("reward-eval/1");
    expect(lateDispatch?.promptVersion).toBe("reward-eval/2");
  });

  it("leaves every earlier intake, dispatch and decision byte-for-byte unchanged", async () => {
    const l = await lane();
    const early = await l.admitAt(10 * MIN);
    await l.score(early.contributionId, 12 * MIN);
    const snapshot = async () =>
      JSON.stringify(
        {
          intakes: await t.db
            .select()
            .from(rewardIntakes)
            .where(eq(rewardIntakes.contributionId, early.contributionId)),
          dispatches: await dispatchesOf(early.contributionId),
          decisions: await t.db
            .select()
            .from(rewardDecisions)
            .where(eq(rewardDecisions.contributionId, early.contributionId)),
        },
        (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      );
    const beforeAmendment = await snapshot();

    await l.amend({}, 30 * MIN);
    const late = await l.admitAt(EFFECTIVE_MS + MIN);
    await l.score(late.contributionId, EFFECTIVE_MS + 2 * MIN);

    expect(await snapshot()).toBe(beforeAmendment);
  });

  it("pins a re-entry admitted after effective_at to the amended config", async () => {
    const l = await lane();
    const original = await l.admitAt(MIN);
    const first = await nominateAt(l, original.contributionId, "n1", 3 * MIN);
    if (first.status !== "nominated") throw new Error(first.status);
    await closeEpoch(
      t.db,
      { communityId: l.community.id, epochId: l.epoch.id },
      { clock: later(WEEK_MS) },
    );
    const epoch2 = await materializeEpochs(
      t.db,
      { communityId: l.community.id },
      { clock: later(WEEK_MS + MIN) },
    );
    const row = await l.amend(
      { epochIndex: 2, effectiveAt: at(WEEK_MS + EFFECTIVE_MS) },
      WEEK_MS + 30 * MIN,
    );

    const again = await nominateAt(l, original.contributionId, "n2", WEEK_MS + EFFECTIVE_MS, {
      contribution: {
        url: "https://x.com/a/status/now",
        text: "edited",
        oembed: null,
        telegramMessageId: 99,
      },
      capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: [] },
    });
    if (again.status !== "nominated") throw new Error(again.status);
    const [reentry] = await t.db
      .select()
      .from(rewardIntakes)
      .where(eq(rewardIntakes.contributionId, again.nomination.contributionId));
    expect(reentry?.epochId).toBe(epoch2.id);
    expect(reentry?.configId).toBe(row.toConfigId);
  });

  it("does not carry into the next epoch, which pins the pending proposal or the base config", async () => {
    const l = await lane();
    await l.amend({}, 30 * MIN);
    const next = await materializeEpochs(
      t.db,
      { communityId: l.community.id },
      { clock: later(WEEK_MS + MIN) },
    );
    expect(next.rewardConfigId).toBe(l.baseConfig.id);
    expect(
      await withCommunityLock(t.db, l.community.id, { clock: later(WEEK_MS + 2 * MIN) }, (tx) =>
        admissionConfigId(tx, next, at(WEEK_MS + 2 * MIN)),
      ),
    ).toBe(l.baseConfig.id);
  });

  it("keeps the O4 proposal path: the pending proposal still activates at its epoch", async () => {
    const l = await lane();
    await l.amend({}, 30 * MIN);
    const proposal = await proposeRewardConfig(
      t.db,
      {
        communityId: l.community.id,
        payload: buildRewardConfigPayload(rubric),
        proposedBy: "test",
      },
      { clock: later(40 * MIN) },
    );
    // Accepted in E1 right after bootstrap (a = 1): earliest E3.
    expect(proposal.earliestActivationEpoch).toBe(3);
    const e3 = await materializeEpochs(
      t.db,
      { communityId: l.community.id },
      { clock: later(2 * WEEK_MS + MIN) },
    );
    expect(e3.rewardConfigId).toBe(proposal.configId);
  });
});

describe("a mixed epoch downstream", () => {
  it("closes and commits each decision with its own config hash", async () => {
    const l = await lane();
    const early = await l.admitAt(10 * MIN);
    await l.score(early.contributionId, 12 * MIN);
    const row = await l.amend({}, 30 * MIN);
    const late = await l.admitAt(EFFECTIVE_MS + MIN);
    await l.score(late.contributionId, EFFECTIVE_MS + 2 * MIN);

    const closed = await closeEpoch(
      t.db,
      { communityId: l.community.id, epochId: l.epoch.id },
      { clock: later(WEEK_MS) },
    );
    if (closed.status !== "closed") throw new Error(closed.status);
    expect(closed.entries.filter((e) => e.decisionId !== null)).toHaveLength(2);

    const c = await epochCommitments(t.db, l.epoch.id);
    const hashes = [...c.decisions.values()].map((d) => d.payload);
    const early1 = hashes.find((p) => p.contribution_id === early.contributionId);
    const late1 = hashes.find((p) => p.contribution_id === late.contributionId);
    expect(early1?.config_hash).toBe(c.configHashes.get(l.baseConfig.id));
    expect(late1?.config_hash).toBe(c.configHashes.get(row.toConfigId));
    expect(early1?.config_hash).not.toBe(late1?.config_hash);
    expect(early1?.model?.prompt_version).toBe("reward-eval/1");
    expect(late1?.model?.prompt_version).toBe("reward-eval/2");
    expect(c.configHash).toBe(c.configHashes.get(l.baseConfig.id));
  });
});

const amendmentsOf = (communityId: string) =>
  t.db
    .select()
    .from(rewardConfigAmendments)
    .where(eq(rewardConfigAmendments.communityId, communityId));

const dispatchesOf = (contributionId: string) =>
  t.db
    .select()
    .from(rewardDispatches)
    .where(eq(rewardDispatches.contributionId, contributionId))
    .orderBy(asc(rewardDispatches.dispatchedAt));

const nominateAt = (
  l: Awaited<ReturnType<typeof lane>>,
  contributionId: string,
  key: string,
  clockMs: number,
  evidence?: Parameters<typeof nominate>[1]["evidence"],
) =>
  nominate(
    t.db,
    {
      communityId: l.community.id,
      memberId: l.member.id,
      contributionId,
      idempotencyKey: key,
      ...(evidence ? { evidence } : {}),
    },
    { clock: later(clockMs) },
  );
