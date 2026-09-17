import { communities, contributions, members, tasks } from "@hyphae/db";
import { and, desc, eq, gt, like } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { boss, QUEUES } from "../../jobs/queue.js";
import { fetchPost, parsePostUrl } from "../../x/oembed.js";
import { reply } from "../reply.js";
import { parseSubmitArgs } from "./args.js";

const USAGE =
  "Usage: /submit <link to your reply>, /submit quote <link to your quote>, or /submit <text of your work>";

export async function submit(ctx: CommandContext<Context>) {
  const args = parseSubmitArgs(ctx.match);
  if (!args) return reply(ctx, USAGE);
  const from = ctx.from;
  if (!from || !ctx.msg) return;
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  const member = await db.query.members.findFirst({
    where: and(eq(members.communityId, community.id), eq(members.telegramUserId, BigInt(from.id))),
  });
  if (!member) return reply(ctx, "Link a wallet first: /link <wallet>");

  let values: typeof contributions.$inferInsert;
  if (args.kind === "text") {
    // Free-form work is scored on its own; it never attaches to a raid.
    values = {
      communityId: community.id,
      memberId: member.id,
      taskId: null,
      kind: "text",
      url: null,
      text: args.text,
      oembed: null,
      telegramMessageId: ctx.msg.message_id,
    };
  } else {
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
      if (dup) return reply(ctx, `You already submitted a ${args.kind} for this raid.`);
    }
    const parsed = parsePostUrl(args.url);
    if (!parsed) return reply(ctx, USAGE);
    const seen = await db.query.contributions.findFirst({
      where: and(
        eq(contributions.communityId, community.id),
        like(contributions.url, `%/status/${parsed.id}`),
      ),
    });
    if (seen) return reply(ctx, "That post was already submitted.");

    const post = await fetchPost(args.url);
    if (!post) return reply(ctx, "Could not read that post. Is it public?");
    if (member.xHandle && post.handle.toLowerCase() !== member.xHandle.toLowerCase()) {
      return reply(
        ctx,
        `That post is by @${post.handle}, but you are linked as @${member.xHandle}.`,
      );
    }
    if (!member.xHandle) {
      await db.update(members).set({ xHandle: post.handle }).where(eq(members.id, member.id));
    }
    values = {
      communityId: community.id,
      memberId: member.id,
      taskId: openTask?.id ?? null,
      kind: args.kind,
      url: post.url,
      text: post.text,
      oembed: post,
      telegramMessageId: ctx.msg.message_id,
    };
  }

  const [row] = await db.insert(contributions).values(values).returning({
    id: contributions.id,
    taskId: contributions.taskId,
  });
  if (!row) return;
  await boss.send(QUEUES.score, { contributionId: row.id }, { singletonKey: row.id });

  const note = row.taskId
    ? ""
    : args.kind === "text"
      ? ""
      : " No raid is open, so this is scored on its own.";
  const rubric = RubricSchema.parse(community.rubric);
  return reply(ctx, `Received. Scoring against rubric ${rubric.version}…${note}`);
}
