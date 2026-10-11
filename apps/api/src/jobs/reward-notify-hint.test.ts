import { communities, rewardDecisions } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { HttpError } from "grammy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeModel } from "../http/demo-seed.js";
import { appendCorrection } from "../rewards/decisions.js";
import { runEvaluation } from "../rewards/evaluation.js";
import { later, seedRewardLane, T0 } from "../rewards/test-db.js";

// Group scores stay public; private eligibility is never read or appended. Notification marking
// and retry behavior are still exercised on the real database (PGlite).
const m = vi.hoisted(() => ({
  sent: [] as { text: string; markup: unknown }[],
  failNext: 0,
  brokenStatus: false,
}));

vi.mock("../env.js", () => ({ env: { PUBLIC_WEB_URL: "https://hyphae.test" } }));
vi.mock("../scoring/default-model.js", () => ({ defaultModel: { id: "test" } }));
vi.mock("./queue.js", () => ({ QUEUES: {}, boss: {} }));
vi.mock("../db.js", async () => {
  const { createTestDb } = await import("../rewards/test-db.js");
  return { db: (await createTestDb()).db };
});
// A status read that fails inside Postgres, which aborts the statement's transaction.
vi.mock("../payout/readiness.js", async (actual) => {
  const real = await actual<typeof import("../payout/readiness.js")>();
  return {
    ...real,
    epochPayouts: (async (tx, ...rest) => {
      if (m.brokenStatus) await tx.execute(sql`select 1 / 0`);
      return real.epochPayouts(tx, ...rest);
    }) satisfies typeof real.epochPayouts,
  };
});
vi.mock("../bot/index.js", () => ({
  bot: {
    token: "1:t",
    isInited: () => true,
    botInfo: { username: "t_bot" },
    api: {
      sendMessage: async (_chat: number, text: string, other: { reply_markup?: unknown }) => {
        if (m.failNext > 0) {
          m.failNext -= 1;
          throw new HttpError("Network request for 'sendMessage' failed!", new Error("down"));
        }
        m.sent.push({ text, markup: other.reply_markup });
      },
    },
  },
}));

const { db } = await import("../db.js");
const { notifyReward } = await import("./reward-jobs.js");

const MIN = 60_000;

// A paid epoch 1 whose member has only a pasted wallet and no rules test pass, so their first
// score message carries the hint.
async function paidLane() {
  const lane = await seedRewardLane(db);
  await db
    .update(communities)
    .set({ firstPaidEpoch: 1 })
    .where(eq(communities.id, lane.community.id));
  const score = async () => {
    const intake = await lane.admitOne();
    const r = await runEvaluation(
      db,
      { communityId: lane.community.id, target: { contributionId: intake.contributionId } },
      { model: "test:fake", call: fakeModel(85), horizonMs: 5 * MIN, clock: later(2 * MIN) },
    );
    if (r.status !== "completed") throw new Error(`score: ${r.status}`);
    return {
      contributionId: intake.contributionId,
      job: {
        communityId: lane.community.id,
        contributionId: intake.contributionId,
        decisionId: r.decision.id,
        text: `scored ${r.decision.id.slice(0, 4)}`,
      },
    };
  };
  return { ...lane, score };
}

const notified = async (decisionId: string) =>
  (
    await db
      .select({ at: rewardDecisions.notifiedAt })
      .from(rewardDecisions)
      .where(eq(rewardDecisions.id, decisionId))
  )[0]?.at ?? null;

beforeEach(() => {
  m.sent = [];
  m.failNext = 0;
  m.brokenStatus = false;
  // The lane's epoch is open: 2026-10-01 to 2026-10-08.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(T0.getTime() + 10 * MIN));
  return () => vi.useRealTimers();
});

describe("notifyReward on the database", () => {
  it("a redelivered job after the mark sends nothing", async () => {
    const lane = await paidLane();
    const { job } = await lane.score();
    await notifyReward(job);
    await notifyReward(job);
    expect(m.sent.map((s) => s.text)).toEqual([job.text]);
    expect(await notified(job.decisionId)).not.toBeNull();
  });

  it("a failed send stays retryable without disclosing eligibility", async () => {
    const lane = await paidLane();
    const first = (await lane.score()).job;
    const second = (await lane.score()).job;
    m.failNext = 1;
    await expect(notifyReward(first)).rejects.toThrow(/telegram/);
    expect(await notified(first.decisionId)).toBeNull();
    await notifyReward(second);
    await notifyReward(first);
    expect(m.sent.map((s) => s.text)).toEqual([second.text, first.text]);
    expect(m.sent.every((s) => !s.text.includes("rules test") && s.markup === undefined)).toBe(
      true,
    );
  });

  it("a corrected revision sends only its public score", async () => {
    const lane = await paidLane();
    const { job, contributionId } = await lane.score();
    await notifyReward(job);
    const corrected = await appendCorrection(
      db,
      {
        communityId: lane.community.id,
        contributionId,
        expectedRevision: 1,
        changes: { rawQuality: 70 },
        reason: "The reply restates the post.",
        evidenceRefs: ["https://x.com/a/status/1"],
        actor: "script:reward-correct",
        idempotencyKey: `c-${contributionId}`,
      },
      { clock: later(20 * MIN) },
    );
    if (corrected.status !== "appended") throw new Error(corrected.status);
    await notifyReward({ ...job, decisionId: corrected.decision.id, text: "revised" });
    expect(m.sent.map((s) => s.text)).toEqual([job.text, "revised"]);
  });

  it("never reads private eligibility while sending a public score", async () => {
    const lane = await paidLane();
    const { job } = await lane.score();
    m.brokenStatus = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await notifyReward(job);
    logged.mockRestore();
    expect(m.sent.map((s) => [s.text, s.markup])).toEqual([[job.text, undefined]]);
    expect(await notified(job.decisionId)).not.toBeNull();
  });
});
