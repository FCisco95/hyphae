import { communities, contributions, type Db, members, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";

export interface ScoreTargetRow {
  chatId: bigint;
  messageId: number;
  kind: "reply" | "quote" | "post" | "text";
  memberUserId: bigint;
  raidHandle: string | null;
}

export interface ScoreTarget {
  chatId: number;
  // Group scores thread under the raid's source message; private ones stand alone.
  replyTo: number | null;
  private: boolean;
  prefix: string | null;
}

// Replies and quotes are submitted privately, so with raid cards on their scores go back to the
// member's private chat. A text /submit in the group keeps its threaded group reply.
export function scoreTarget(row: ScoreTargetRow, privateScores: boolean): ScoreTarget {
  if (privateScores && (row.kind === "reply" || row.kind === "quote"))
    return {
      chatId: Number(row.memberUserId),
      replyTo: null,
      private: true,
      prefix: row.raidHandle
        ? `Your ${row.kind} on the @${row.raidHandle} raid:`
        : `Your ${row.kind}:`,
    };
  return { chatId: Number(row.chatId), replyTo: row.messageId, private: false, prefix: null };
}

export const scoreText = (target: ScoreTarget, text: string) =>
  target.prefix ? `${target.prefix}\n${text}` : text;

export async function loadScoreTarget(db: Db, contributionId: string): Promise<ScoreTargetRow> {
  const [row] = await db
    .select({
      chatId: communities.telegramChatId,
      messageId: contributions.telegramMessageId,
      kind: contributions.kind,
      memberUserId: members.telegramUserId,
      raidHandle: tasks.targetAuthor,
    })
    .from(contributions)
    .innerJoin(communities, eq(communities.id, contributions.communityId))
    .innerJoin(members, eq(members.id, contributions.memberId))
    .leftJoin(tasks, eq(tasks.id, contributions.taskId))
    .where(eq(contributions.id, contributionId));
  if (!row) throw new Error(`score route: contribution ${contributionId} missing`);
  return row;
}
