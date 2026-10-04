import { contributions, rewardIntakes, rewardNominations } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapRewardEpochs, buildRewardConfigPayload } from "../../rewards/config.js";
import { runEvaluation } from "../../rewards/evaluation.js";
import { admitContribution, capturedEvidence } from "../../rewards/intake.js";
import { at, createTestDb, rubric, seedCommunity, seedTask } from "../../rewards/test-db.js";

const state = vi.hoisted(() => ({
  db: null as unknown,
  evaluation: vi.fn(),
  retrieval: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("../../db.js", () => ({
  get db() {
    return state.db;
  },
}));
vi.mock("../../jobs/queue.js", () => ({ boss: { send: vi.fn() }, QUEUES: { score: "score" } }));
vi.mock("../../jobs/reward-jobs.js", () => ({
  sendEvaluation: state.evaluation,
  sendRetrieval: state.retrieval,
}));
vi.mock("../../x/oembed.js", async (original) => ({
  ...(await original<object>()),
  fetchPost: state.fetch,
}));
let t: Awaited<ReturnType<typeof createTestDb>>;
let bot: Bot;
let sequence = 1;
const sent: string[] = [];
const command = (text: string, chatId: number): Update => ({
  update_id: ++sequence,
  message: {
    message_id: sequence,
    date: 1,
    chat: { id: chatId, type: "supergroup", title: "Lab" },
    from: { id: 42, is_bot: false, first_name: "Member" },
    text,
    entities: [{ type: "bot_command", offset: 0, length: "/effort".length }],
  },
});
async function lane() {
  const result = await seedCommunity(t.db);
  await bootstrapRewardEpochs(
    t.db,
    {
      communityId: result.community.id,
      payload: buildRewardConfigPayload(rubric),
      opensAt: new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000),
      proposedBy: "fixture",
    },
    { clock: at(new Date(Date.now() - 3_600_000)) },
  );
  return { ...result, chatId: Number(result.community.telegramChatId) };
}
beforeAll(async () => {
  t = await createTestDb();
  state.db = t.db;
  const { effort } = await import("./effort.js");
  bot = new Bot("1:fixture", {
    botInfo: { id: 1, is_bot: true, first_name: "T", username: "fixture_bot" } as UserFromGetMe,
  });
  bot.command("effort", effort);
  bot.api.config.use(async (_previous, method, payload) => {
    if (method !== "sendMessage") throw new Error(`Unexpected Telegram request ${method}`);
    sent.push(String((payload as { text: string }).text));
    return { ok: true, result: true } as never;
  });
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  sent.length = 0;
  state.evaluation.mockReset().mockResolvedValue("job");
  state.retrieval.mockReset().mockResolvedValue("job");
  state.fetch.mockReset().mockImplementation(() => {
    throw new Error("Unexpected provider call");
  });
});
describe("explicit effort nomination command", () => {
  it("explains existing-URL nomination, exact-raid submission and separate text work", async () => {
    const { chatId } = await lane();
    await bot.handleUpdate(command("/effort", chatId));
    expect(sent.at(-1)).toContain("already submitted");
    expect(sent.at(-1)).toContain("exact raid");
    expect(sent.at(-1)).toContain("separate work");
  });
  it("refuses a new URL without inferring the latest active task or creating intake", async () => {
    const { community, chatId } = await lane();
    await seedTask(t.db, community.id, new Date(Date.now() - 2000));
    await seedTask(t.db, community.id, new Date(Date.now() - 1000));
    await bot.handleUpdate(command("/effort https://x.com/member/status/910", chatId));
    expect(sent.at(-1)).toContain("exact raid's private Submit button");
    expect(sent.at(-1)).toContain("link alone cannot select a raid");
    expect(
      await t.db.select().from(contributions).where(eq(contributions.communityId, community.id)),
    ).toHaveLength(0);
    expect(
      await t.db.select().from(rewardIntakes).where(eq(rewardIntakes.communityId, community.id)),
    ).toHaveLength(0);
    expect(
      await t.db
        .select()
        .from(rewardNominations)
        .where(eq(rewardNominations.communityId, community.id)),
    ).toHaveLength(0);
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.evaluation).not.toHaveBeenCalled();
  });
  it("nominates a previously admitted and scored URL without resubmitting or recapturing it", async () => {
    const { community, member, chatId } = await lane();
    const post = {
      id: "911",
      handle: "member",
      url: "https://x.com/member/status/911",
      text: "Detailed reproducible community work",
    };
    const evidence = capturedEvidence({ post }, 12, new Date());
    const admitted = await admitContribution(t.db, {
      communityId: community.id,
      memberId: member.id,
      artifactKey: "x:status:911",
      idempotencyKey: "fixture:911",
      ...evidence,
      contribution: { ...evidence.contribution, kind: "post" },
    });
    if (admitted.status !== "admitted") throw new Error(admitted.status);
    expect(
      await runEvaluation(
        t.db,
        { communityId: community.id, target: { contributionId: admitted.intake.contributionId } },
        {
          model: "test:fake", // Fixture routing only; no provider request.
          horizonMs: 300_000,
          call: async () => ({
            output: {
              score: 85,
              rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
              flags: [],
              aiSlop: { patterns: [], templateRhythm: false },
              reasoning: "Specific to the post and adds a checked result.",
            },
            latencyMs: 1,
            costMicroUsd: 0,
          }),
        },
      ),
    ).toMatchObject({ status: "completed" });
    await bot.handleUpdate(command(`/effort ${post.url}`, chatId));
    expect(sent.at(-1)).toContain("Nominated for an effort upgrade");
    const nominations = await t.db
      .select()
      .from(rewardNominations)
      .where(eq(rewardNominations.communityId, community.id));
    expect(nominations).toHaveLength(1);
    expect(nominations[0]).toMatchObject({
      contributionId: admitted.intake.contributionId,
      state: "ready",
      kind: "upgrade",
    });
    expect(state.evaluation).toHaveBeenCalledWith({
      communityId: community.id,
      target: { nominationId: nominations[0]?.id },
    });
    expect(
      await t.db.select().from(contributions).where(eq(contributions.communityId, community.id)),
    ).toHaveLength(1);
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.retrieval).not.toHaveBeenCalled();
  });
  it("keeps a new standalone text nomination separate from the active raid", async () => {
    const { community, chatId } = await lane();
    await seedTask(t.db, community.id, new Date(Date.now() - 1000));
    await bot.handleUpdate(
      command("/effort My independently described and reproducible community work", chatId),
    );
    expect(sent.at(-1)).toContain("Nominated for your effort slot");
    const rows = await t.db
      .select()
      .from(contributions)
      .where(eq(contributions.communityId, community.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "text", taskId: null });
    expect(state.evaluation).toHaveBeenCalledTimes(1);
  });
});
