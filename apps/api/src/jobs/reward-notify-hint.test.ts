import { communities, rewardDecisions } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { HttpError } from "grammy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeModel } from "../http/demo-seed.js";
import { appendCorrection } from "../rewards/decisions.js";
import { runEvaluation } from "../rewards/evaluation.js";
import { later, seedRewardLane, T0 } from "../rewards/test-db.js";

// notifyReward on a real database (PGlite): the score message, its once-per-epoch payout hint and
// the mark, in the transaction that holds the member and epoch's lock.
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
const HINT =
  "Not payable yet: link a wallet by signing and pass the rules test before the epoch closes.";

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
const hints = () => m.sent.filter((s) => s.text.endsWith(HINT)).length;

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
    expect(m.sent.map((s) => s.text)).toEqual([`${job.text}\n${HINT}`]);
    expect(await notified(job.decisionId)).not.toBeNull();
  });

  it("a failed send marks nothing and spends no hint: the next message carries it", async () => {
    const lane = await paidLane();
    const first = (await lane.score()).job;
    const second = (await lane.score()).job;
    m.failNext = 1;
    await expect(notifyReward(first)).rejects.toThrow(/telegram/);
    expect(await notified(first.decisionId)).toBeNull();
    await notifyReward(second);
    await notifyReward(first);
    expect(m.sent.map((s) => s.text)).toEqual([`${second.text}\n${HINT}`, first.text]);
    expect(hints()).toBe(1);
  });

  it("a corrected revision after the member was told carries no hint", async () => {
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
    expect(m.sent.map((s) => s.text)).toEqual([`${job.text}\n${HINT}`, "revised"]);
  });

  it("a status read that fails in the database still sends and marks the score", async () => {
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
