import { canonicalJson, type PublicRaid, publicXPost } from "@hyphae/core";
import { communities, type Db, integrationRaidRequests, tasks } from "@hyphae/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { fullCreditClock, publicRaid, raidColumns } from "../http/read-raids.js";
import { activeRaids, MAX_OPEN_RAIDS, recordOpening } from "../raid-alerts/alerts.js";
import { type Clock, dbClock } from "../rewards/config.js";
import type { XPost } from "../x/oembed.js";
import { sha256Hex } from "./hmac.js";

// A raid posted by Organic's server for a community admin or steward (contract 2026-10-30 §7). It
// gets /raid's checks, records and announcement; Organic resolved the actor, Hyphae keeps it for
// audit and trusts it only because the request is signed.

export const RaidRequestSchema = z.strictObject({
  idempotency_key: z.uuid(),
  post_url: z.string().min(1).max(512),
  brief: z.string().min(1).max(2000),
  // A raid opens when Hyphae records it; a stated opening must be now, give or take a minute.
  opens_at: z.iso.datetime().optional(),
  closes_at: z.iso.datetime(),
  actor: z.strictObject({ organic_user_id: z.uuid(), role: z.enum(["admin", "steward"]) }),
});
export type RaidRequest = z.infer<typeof RaidRequestSchema>;

export type PostRaidResult =
  | { status: 201; body: { raid: PublicRaid } }
  | { status: 400 | 403 | 409 | 503; error: string };

type Community = typeof communities.$inferSelect;
type Task = typeof tasks.$inferSelect;
export interface PostRaidDeps {
  db: Db;
  fetchPost(url: string): Promise<XPost | null>;
  // The bot's own Telegram user id: the actor of the raid's lifecycle event.
  botId(): Promise<bigint>;
  // Sends the group announcement and returns its message id.
  announce(community: Community, post: XPost, task: Task, hours: number): Promise<number>;
  clock?: Clock;
}

const OPENS_SKEW_MS = 60_000;
const MIN_WINDOW_MS = 60_000;
const MAX_WINDOW_MS = 30 * 24 * 3_600_000;

const fail = (status: 400 | 403 | 409 | 503, error: string): PostRaidResult => ({ status, error });

// The first answer to this idempotency key, or why the key cannot be answered again.
async function earlier(
  tx: Db,
  communityId: string,
  key: string,
  hash: string,
): Promise<PostRaidResult | undefined> {
  const [row] = await tx
    .select({
      hash: integrationRaidRequests.requestHash,
      state: integrationRaidRequests.state,
      response: integrationRaidRequests.response,
    })
    .from(integrationRaidRequests)
    .where(
      and(
        eq(integrationRaidRequests.communityId, communityId),
        eq(integrationRaidRequests.idempotencyKey, key),
      ),
    );
  if (!row) return undefined;
  if (row.hash !== hash) return fail(409, "idempotency_conflict");
  if (row.state !== "created") return fail(409, "request_in_progress");
  return { status: 201, body: row.response as { raid: PublicRaid } };
}

export async function postRaid(
  deps: PostRaidDeps,
  mint: string,
  keyId: string,
  request: RaidRequest,
): Promise<PostRaidResult> {
  const { db } = deps;
  const clock = deps.clock ?? dbClock;
  const hash = sha256Hex(canonicalJson(request));
  const [community] = await db.select().from(communities).where(eq(communities.mint, mint));
  if (!community) return fail(403, "community_not_registered");
  const replay = await earlier(db, community.id, request.idempotency_key, hash);
  if (replay) return replay;
  if (community.rewardIntakePausedAt) return fail(403, "intake_paused");
  const link = publicXPost(request.post_url);
  if (!link?.handle) return fail(400, "invalid_post_url");
  const post = await deps.fetchPost(link.url);
  if (!post) return fail(400, "post_unreadable");
  let botId: bigint;
  try {
    botId = await deps.botId();
  } catch {
    return fail(503, "telegram_unavailable");
  }

  // Reserve: the task counts toward the cap from here, but has no message id yet, so no member can
  // submit to it until its announcement is bound.
  const reserved = await db.transaction(async (tx): Promise<PostRaidResult | { task: Task }> => {
    const [locked] = await tx
      .select()
      .from(communities)
      .where(eq(communities.id, community.id))
      .for("no key update");
    if (!locked) return fail(403, "community_not_registered");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`integration-raid:${community.id}:${request.idempotency_key}`}))`,
    );
    const again = await earlier(tx, community.id, request.idempotency_key, hash);
    if (again) return again;
    if (locked.rewardIntakePausedAt) return fail(403, "intake_paused");
    const now = await clock(tx, community.id);
    if (request.opens_at && Math.abs(Date.parse(request.opens_at) - now.getTime()) > OPENS_SKEW_MS)
      return fail(400, "scheduling_unsupported");
    const window = Date.parse(request.closes_at) - now.getTime();
    if (window < MIN_WINDOW_MS || window > MAX_WINDOW_MS) return fail(400, "invalid_window");
    if ((await activeRaids(tx, community.id, now)).length >= MAX_OPEN_RAIDS)
      return fail(409, "open_raid_limit");
    const [task] = await tx
      .insert(tasks)
      .values({
        communityId: community.id,
        kind: "raid",
        status: "open",
        targetUrl: post.url,
        targetText: post.text,
        targetAuthor: post.handle,
        brief: request.brief,
        opensAt: now,
        closesAt: new Date(request.closes_at),
        telegramMessageId: null,
      })
      .returning();
    if (!task) throw new Error("integration: raid creation failed");
    await tx.insert(integrationRaidRequests).values({
      communityId: community.id,
      idempotencyKey: request.idempotency_key,
      requestHash: hash,
      keyId,
      actorOrganicUserId: request.actor.organic_user_id,
      actorRole: request.actor.role,
      taskId: task.id,
      state: "announcing",
      createdAt: now,
    });
    return { task };
  });
  if (!("task" in reserved)) return reserved;
  const { task } = reserved;

  let messageId: number;
  try {
    const hours = Math.round((task.closesAt.getTime() - task.opensAt.getTime()) / 36_000) / 100;
    messageId = await deps.announce(community, post, task, hours);
  } catch (error) {
    await release(db, task.id);
    console.error(
      JSON.stringify({
        integration: "announce_failed",
        task: task.id,
        error: (error as Error).name,
      }),
    );
    return fail(503, "telegram_unavailable");
  }

  return db.transaction(async (tx) => {
    await tx
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.id, community.id))
      .for("no key update");
    const now = await clock(tx, community.id);
    const [bound] = await tx
      .update(tasks)
      .set({ telegramMessageId: messageId })
      .where(and(eq(tasks.id, task.id), isNull(tasks.telegramMessageId)))
      .returning({ id: tasks.id });
    if (!bound) throw new Error(`integration: raid ${task.id} changed before it was announced`);
    await recordOpening(tx, {
      communityId: community.id,
      chatId: community.telegramChatId,
      messageId,
      actorId: botId,
      taskId: task.id,
      reason: task.brief || "Raid opened",
      now,
    });
    const [row] = await tx.select(raidColumns).from(tasks).where(eq(tasks.id, task.id));
    if (!row) throw new Error(`integration: raid ${task.id} missing`);
    const body = { raid: publicRaid(row, now, false, await fullCreditClock(tx, community.id)) };
    await tx
      .update(integrationRaidRequests)
      .set({ state: "created", response: body, completedAt: now })
      .where(eq(integrationRaidRequests.taskId, task.id));
    return { status: 201 as const, body };
  });
}

// An unannounced reservation is undone, so the same request can be sent again. If a card was
// recorded before the failure the task stays, unsubmittable, and the key answers in progress.
async function release(db: Db, taskId: string) {
  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(integrationRaidRequests)
        .where(
          and(
            eq(integrationRaidRequests.taskId, taskId),
            eq(integrationRaidRequests.state, "announcing"),
          ),
        );
      await tx.delete(tasks).where(and(eq(tasks.id, taskId), isNull(tasks.telegramMessageId)));
    });
  } catch (error) {
    console.error(
      JSON.stringify({ integration: "release_failed", task: taskId, error: (error as Error).name }),
    );
  }
}
