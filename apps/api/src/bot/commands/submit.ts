import { communities, contributions, members, tasks } from "@hyphae/db";
import { and, desc, eq, gt, like } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { boss, QUEUES } from "../../jobs/queue.js";
import { sendEvaluation } from "../../jobs/reward-jobs.js";
import {
  type AdmitInput,
  type AdmitResult,
  artifactKeyFor,
  capturedEvidence,
} from "../../rewards/intake.js";
import { routeSubmission } from "../../rewards/submission.js";
import { fetchPost, parsePostUrl } from "../../x/oembed.js";
import { reply } from "../reply.js";
import { parseSubmitArgs, type SubmitArgs } from "./args.js";
import { bindHandle, MAX_HANDLES } from "./handles.js";

const USAGE =
  "Usage: /submit <link to your reply>, /submit quote <link to your quote>, or /submit <text of your work>";

type Community = typeof communities.$inferSelect;
type Member = typeof members.$inferSelect;

export async function communityAndMember(
  ctx: CommandContext<Context>,
): Promise<{ community: Community; member: Member } | string> {
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return "This chat is not a registered Hyphae community.";
  const member = await db.query.members.findFirst({
    where: and(
      eq(members.communityId, community.id),
      eq(members.telegramUserId, BigInt(ctx.from?.id ?? 0)),
    ),
  });
  if (!member) return "Link a wallet first: send /link.";
  return { community, member };
}

// Format, oEmbed read, handle binding, one reply and one quote per raid, and the URL dedupe run
// before admission and before any model call. Returns the admission input or the refusal text.
export async function preflight(
  ctx: CommandContext<Context>,
  args: SubmitArgs,
  community: Community,
  member: Member,
): Promise<AdmitInput | string> {
  const messageId = ctx.msg?.message_id ?? 0;
  const base = {
    communityId: community.id,
    memberId: member.id,
    idempotencyKey: `tg:${ctx.chat.id}:${messageId}`,
  };
  if (args.kind === "text") {
    // Free-form work is scored on its own; it never attaches to a raid.
    const { contribution, capture } = capturedEvidence(args, messageId, new Date());
    return {
      ...base,
      taskId: null,
      contribution: { kind: "text", ...contribution },
      artifactKey: artifactKeyFor({ text: args.text }),
      capture,
    };
  }
  const openTask = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.communityId, community.id),
      eq(tasks.status, "open"),
      gt(tasks.closesAt, new Date()),
    ),
    orderBy: [desc(tasks.opensAt)],
  });
  // One reply and one quote per member per raid, refused before any model call.
  if (openTask) {
    const dup = await db.query.contributions.findFirst({
      where: and(
        eq(contributions.memberId, member.id),
        eq(contributions.taskId, openTask.id),
        eq(contributions.kind, args.kind),
      ),
    });
    if (dup) return `You already submitted a ${args.kind} for this raid.`;
  }
  const parsed = parsePostUrl(args.url);
  if (!parsed) return USAGE;
  const seen = await db.query.contributions.findFirst({
    where: and(
      eq(contributions.communityId, community.id),
      like(contributions.url, `%/status/${parsed.id}`),
    ),
  });
  if (seen) return "That post was already submitted.";

  const post = await fetchPost(args.url);
  if (!post) return "Could not read that post. Is it public?";
  const bind = bindHandle(member.xHandles, post.handle);
  if (!bind.ok) {
    const known = bind.handles.map((h) => `@${h}`).join(", ");
    return `That post is by @${post.handle}; you submit as ${known} (max ${MAX_HANDLES}).`;
  }
  if (bind.bound) {
    await db.update(members).set({ xHandles: bind.handles }).where(eq(members.id, member.id));
  }
  const { contribution, capture } = capturedEvidence({ post }, messageId, new Date());
  return {
    ...base,
    taskId: openTask?.id ?? null,
    contribution: { kind: args.kind, ...contribution },
    artifactKey: artifactKeyFor({ statusId: post.id }),
    capture,
  };
}

export const ADMIT_REFUSAL: Record<Exclude<AdmitResult["status"], "admitted">, string> = {
  duplicate_artifact: "That post was already submitted.",
  paused: "Reward intake is paused in this community.",
  not_open: "The first reward epoch has not opened yet.",
  legacy_epoch: "This community's epochs predate reward intake.",
  before_task_open: "That raid has not opened yet.",
  task_closed: "That raid has closed.",
};

export async function submit(ctx: CommandContext<Context>) {
  const args = parseSubmitArgs(ctx.match);
  if (!args) return reply(ctx, USAGE);
  if (!ctx.from || !ctx.msg) return;
  const found = await communityAndMember(ctx);
  if (typeof found === "string") return reply(ctx, found);
  const { community } = found;
  const input = await preflight(ctx, args, community, found.member);
  if (typeof input === "string") return reply(ctx, input);

  const routed = await routeSubmission(db, input);
  if (routed.lane === "reward") {
    const { result } = routed;
    if (result.status !== "admitted") return reply(ctx, ADMIT_REFUSAL[result.status]);
    await sendEvaluation({
      communityId: community.id,
      target: { contributionId: result.intake.contributionId },
    });
    return reply(ctx, "Received for this epoch. Scoring against its pinned rubric…");
  }

  const [row] = await db
    .insert(contributions)
    .values({
      ...input.contribution,
      communityId: community.id,
      memberId: input.memberId,
      taskId: input.taskId ?? null,
    })
    .returning({ id: contributions.id, taskId: contributions.taskId });
  if (!row) return;
  await boss.send(QUEUES.score, { contributionId: row.id }, { singletonKey: row.id });

  const note =
    args.kind !== "text" && !row.taskId ? " No raid is open, so this is scored on its own." : "";
  return reply(ctx, `Received. Scoring against rubric ${community.rubricVersion}…${note}`);
}
