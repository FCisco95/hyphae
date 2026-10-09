import { timingSafeEqual } from "node:crypto";
import { MemberAccountSchema } from "@hyphae/core";
import { communities, type Db, members } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { isMemberStatus } from "../bot/membership.js";
import { telegramIdentity } from "./identity.js";
import { tokenBucket } from "./limits.js";
import type { MemberIdentityProvider } from "./privy.js";
import { ipBucketKey } from "./visitor.js";

const GroupMembership = z
  .object({
    status: z.enum(["member", "administrator", "creator", "restricted", "left", "kicked"]),
    is_member: z.boolean().optional(),
  })
  .refine((value) => value.status !== "restricted" || value.is_member !== undefined);

export function memberRoutes({
  db,
  identity,
  chatMember,
  webToken,
  now = () => new Date(),
}: {
  db: Db;
  identity?: MemberIdentityProvider;
  webToken?: string;
  chatMember?: (
    chatId: bigint,
    userId: bigint,
    signal: AbortSignal,
  ) => Promise<{ status: string; is_member?: boolean }>;
  now?: () => Date;
}): Hono {
  const app = new Hono();
  const ipAllowed = tokenBucket({ capacity: 30, refillPerMinute: 60 });
  const subjectAllowed = tokenBucket({ capacity: 5, refillPerMinute: 20 });
  const expectedWeb = webToken ? Buffer.from(webToken) : null;
  const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
  app.use("*", async (c, next) => {
    c.header("Cache-Control", headers["Cache-Control"]);
    c.header("Vary", headers.Vary);
    await next();
  });
  app.onError((_, c) => c.json({ error: "unavailable" }, 503, headers));
  app.notFound((c) => c.json({ error: "not_found" }, 404, headers));
  app.get("/communities/:mint/me", async (c) => {
    const mint = c.req.param("mint");
    if (!/^[A-Za-z0-9]{1,64}$/.test(mint) || new URL(c.req.url).search !== "")
      return c.json({ error: "invalid_request" }, 400);
    // Fly overwrites this header at its edge. Off Fly all callers share the local budget.
    const credential = c.req.header("x-hyphae-web-token");
    const receivedWeb = credential && credential.length <= 4096 ? Buffer.from(credential) : null;
    const trustedWeb =
      expectedWeb &&
      receivedWeb &&
      expectedWeb.length === receivedWeb.length &&
      timingSafeEqual(expectedWeb, receivedWeb);
    // This credential attests only the proxy visitor; the user's app-bound token is still required.
    const ip = trustedWeb ? c.req.header("x-hyphae-visitor") : c.req.header("fly-client-ip");
    const key = ipBucketKey(ip);
    if (!ipAllowed(key)) return c.json({ error: "unavailable" }, 429, { "Retry-After": "3" });
    if (!identity || !chatMember) return c.json({ error: "unavailable" }, 503);
    const authorization = c.req.header("authorization");
    if (!authorization || authorization.length > 4103)
      return c.json({ error: "unauthorized" }, 401);
    const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
      authorization,
    )?.[1];
    if (!token) return c.json({ error: "unauthorized" }, 401);
    let subject: string;
    try {
      subject = await identity.verify(token);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (!subjectAllowed(subject))
      return c.json({ error: "unavailable" }, 429, { "Retry-After": "3" });
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(new Error("member_unavailable"));
      }, 5000);
    });
    try {
      const result = await Promise.race([
        timeout,
        (async () => {
          const [community] = await db
            .select({
              id: communities.id,
              mint: communities.mint,
              name: communities.name,
              chatId: communities.telegramChatId,
            })
            .from(communities)
            .where(eq(communities.mint, mint))
            .limit(1);
          abort.signal.throwIfAborted();
          if (!community) return null;
          const common = {
            community: { mint: community.mint, name: community.name },
            as_of: now().toISOString(),
          };
          const user = await identity.currentUser(subject, abort.signal);
          abort.signal.throwIfAborted();
          const telegramId = telegramIdentity(user, subject);
          if (telegramId === null)
            return MemberAccountSchema.parse({ ...common, state: "telegram_required" });
          const group = GroupMembership.parse(
            await chatMember(community.chatId, telegramId, abort.signal),
          );
          abort.signal.throwIfAborted();
          const status =
            group.is_member === undefined
              ? { status: group.status }
              : { status: group.status, is_member: group.is_member };
          if (!isMemberStatus(status))
            return MemberAccountSchema.parse({ ...common, state: "join_required" });
          const [member] = await db
            .select({
              wallet: members.wallet,
              method: members.linkMethod,
              linkedAt: members.linkedAt,
            })
            .from(members)
            .where(
              and(eq(members.communityId, community.id), eq(members.telegramUserId, telegramId)),
            )
            .limit(1);
          abort.signal.throwIfAborted();
          if (!member)
            return MemberAccountSchema.parse({ ...common, state: "member_not_registered" });
          if (
            (member.wallet === null) !== (member.method === null) ||
            (member.wallet === null) !== (member.linkedAt === null)
          )
            throw new Error("member_unavailable");
          return MemberAccountSchema.parse({
            ...common,
            state: "member",
            wallet: { address: member.wallet, status: member.method ?? "none" },
          });
        })(),
      ]);
      if (!result) return c.json({ error: "not_found" }, 404);
      return c.json(result);
    } catch {
      return c.json({ error: "unavailable" }, 503);
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  });
  return app;
}
