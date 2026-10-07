import { communities, contributions, type members } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { boss, QUEUES } from "../../jobs/queue.js";
import { sendEvaluation } from "../../jobs/reward-jobs.js";
import { ensureMember } from "../../member-journey/ensure-member.js";
import {
  type AdmitInput,
  type AdmitResult,
  artifactKeyFor,
  capturedEvidence,
} from "../../rewards/intake.js";
import { routeSubmission } from "../../rewards/submission.js";
import { isMemberStatus } from "../membership.js";
import { reply } from "../reply.js";
import { parseSubmitArgs, type SubmitArgs } from "./args.js";

const USAGE =
  "Use the exact raid’s Submit button for replies/quotes, or /submit <text of your separate work> in the group.";

type Community = typeof communities.$inferSelect;
type Member = typeof members.$inferSelect;

export async function communityAndMember(
  ctx: CommandContext<Context>,
): Promise<{ community: Community; member: Member } | string> {
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return "This chat is not a registered Hyphae community.";
  if (!ctx.from || ctx.from.is_bot) return "Send this from your own Telegram account.";
  // Writing in a group does not prove belonging to it (a discussion group can let anyone comment),
  // so Telegram is asked every time; a first submission then creates the member row without a
  // wallet (earn first, ruled 2026-10-07).
  try {
    if (!isMemberStatus(await ctx.api.getChatMember(ctx.chat.id, ctx.from.id)))
      return "You must currently belong to this community's group.";
  } catch {
    return "Membership could not be checked. Nothing was accepted; try again.";
  }
  const member = await ensureMember(db, {
    communityId: community.id,
    telegramUserId: BigInt(ctx.from.id),
    telegramUsername: ctx.from.username ?? null,
  });
  return { community, member };
}

// Linked raid work must use an explicit private prompt. Standalone text stays separate.
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
  return "For a reply or quote, open the exact raid's private Submit button. A link alone cannot select a raid. Free-form /submit text is separate work.";
}

export const ADMIT_REFUSAL: Record<Exclude<AdmitResult["status"], "admitted">, string> = {
  duplicate_artifact: "That post was already submitted.",
  paused: "Reward intake is paused in this community.",
  not_open: "The first reward epoch has not opened yet.",
  legacy_epoch: "This community's epochs predate reward intake.",
  before_task_open: "That raid has not opened yet.",
  task_closed: "That raid has closed.",
  kind_taken: "You already submitted one of those for this raid.",
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
