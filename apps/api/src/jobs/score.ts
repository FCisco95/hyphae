import { creditedScore, RubricSchema, type ScoringInput, timingMultiplier } from "@hyphae/core";
import { communities, contributions, members, scoringRuns, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { bot } from "../bot/index.js";
import { db } from "../db.js";
import { env } from "../env.js";
import { scoringModel } from "../scoring/provider.js";
import { runScoring } from "../scoring/run.js";
import type { XPost } from "../x/oembed.js";
import { scoreMessage } from "./score-message.js";

export interface ScoreJob {
  contributionId: string;
  // Re-score after a rubric change: adds a new run next to the old one instead of skipping.
  force?: boolean;
}

const model = scoringModel(env.SCORING_MODEL, {
  anthropic: env.ANTHROPIC_API_KEY,
  deepseek: env.DEEPSEEK_API_KEY,
});

async function loadContribution(contributionId: string) {
  const c = await db.query.contributions.findFirst({ where: eq(contributions.id, contributionId) });
  if (!c) throw new Error(`score: contribution ${contributionId} missing`);
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, c.communityId),
  });
  if (!community) throw new Error(`score: community ${c.communityId} missing`);
  return { c, community };
}

export async function scoreContribution({ contributionId, force }: ScoreJob): Promise<void> {
  const { c, community } = await loadContribution(contributionId);
  // A retry after the run was stored must not pay for a second model call.
  const existing = force
    ? undefined
    : await db.query.scoringRuns.findFirst({ where: eq(scoringRuns.contributionId, c.id) });
  if (existing) return;

  const member = await db.query.members.findFirst({ where: eq(members.id, c.memberId) });
  if (!member) throw new Error(`score: member ${c.memberId} missing`);
  const rubric = RubricSchema.parse(community.rubric);
  const task = c.taskId
    ? await db.query.tasks.findFirst({ where: eq(tasks.id, c.taskId) })
    : undefined;

  const input: ScoringInput = {
    rubric,
    task: task?.targetUrl
      ? {
          targetUrl: task.targetUrl,
          targetText: task.targetText ?? "",
          targetAuthor: task.targetAuthor ?? "",
          brief: task.brief,
        }
      : undefined,
    contribution: {
      kind: c.kind,
      url: c.url ?? undefined,
      text: c.text,
      authorHandle: (c.oembed as XPost | null)?.handle,
    },
  };
  const result = await runScoring(input, model);
  const multiplier = timingMultiplier(rubric, task?.opensAt, c.submittedAt);
  const credited = creditedScore(result.output);

  const [run] = await db
    .insert(scoringRuns)
    .values({
      contributionId: c.id,
      model: result.model,
      rubricVersion: result.rubricVersion,
      promptHash: result.promptHash,
      input: result.input,
      output: result.output,
      score: credited, // raw model score stays in output.score; this is what settles
      timingMultiplier: Math.round(multiplier * 10_000),
      flags: result.output.flags,
      reasoning: result.output.reasoning,
      latencyMs: result.latencyMs,
      costMicroUsd: result.costMicroUsd,
      evidenceHash: result.evidenceHash,
    })
    .onConflictDoNothing({ target: scoringRuns.evidenceHash })
    .returning({ id: scoringRuns.id });
  console.log(
    JSON.stringify({
      job: "score",
      contributionId: c.id,
      run: run?.id ?? null,
      model: result.model,
      raw: result.output.score,
      credited,
      multiplier,
      flags: result.output.flags,
      latencyMs: result.latencyMs,
      costMicroUsd: result.costMicroUsd,
    }),
  );
  if (!run) return;

  // The score is stored; a Telegram hiccup must not fail the job into a second paid run.
  try {
    await bot.api.sendMessage(
      Number(community.telegramChatId),
      scoreMessage({ output: result.output, multiplier, url: `${env.PUBLIC_WEB_URL}/x/${c.id}` }),
      {
        reply_parameters: { message_id: c.telegramMessageId, allow_sending_without_reply: true },
        link_preview_options: { is_disabled: true },
      },
    );
  } catch (err) {
    console.error("score: notify failed", { contributionId: c.id, err });
  }
}

export async function notifyScoringFailed(contributionId: string): Promise<void> {
  const { c, community } = await loadContribution(contributionId);
  await bot.api.sendMessage(
    Number(community.telegramChatId),
    "Scoring failed for this submission. It is saved; an admin will re-run it.",
    { reply_parameters: { message_id: c.telegramMessageId, allow_sending_without_reply: true } },
  );
}
