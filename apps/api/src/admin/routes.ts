import { timingSafeEqual } from "node:crypto";
import { type AdminIntakeUpdate, AdminIntakeUpdateSchema } from "@hyphae/core";
import type { Db } from "@hyphae/db";
import { type Context, Hono } from "hono";
import { telegramIdentity } from "../member-auth/identity.js";
import { tokenBucket } from "../member-auth/limits.js";
import type { MemberIdentityProvider } from "../member-auth/privy.js";
import { ipBucketKey } from "../member-auth/visitor.js";
import { AdminError, assertActive, within } from "./guard.js";
import { administerCommunity } from "./service.js";

const MAX_BODY_BYTES = 1024;
const MINT = /^[A-Za-z0-9]{1,64}$/;
export type TelegramAdmin = (
  chatId: bigint,
  actorId: bigint,
  signal: AbortSignal,
) => Promise<boolean>;

async function updateBody(request: Request, signal: AbortSignal): Promise<AdminIntakeUpdate> {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
      "application/json" ||
    (request.headers.has("content-encoding") &&
      request.headers.get("content-encoding") !== "identity")
  )
    throw new AdminError("invalid_request", 400);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES))
    throw new AdminError("invalid_request", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminError("invalid_request", 400);
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await within(reader.read(), signal);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BODY_BYTES) throw new AdminError("invalid_request", 400);
      parts.push(part.value);
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts));
    const parsed = AdminIntakeUpdateSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AdminError("invalid_request", 400);
    return parsed.data;
  } catch (error) {
    cancel();
    if (error instanceof AdminError) throw error;
    throw new AdminError("invalid_request", 400);
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export function adminRoutes(deps: {
  db: Db;
  enabled?: boolean;
  identity?: MemberIdentityProvider;
  telegramAdmin?: TelegramAdmin;
  webToken?: string;
  timeoutMs?: number;
}) {
  const app = new Hono();
  const ipAllowed = tokenBucket({ capacity: 30, refillPerMinute: 60 });
  const subjectAllowed = tokenBucket({ capacity: 5, refillPerMinute: 20 });
  const expectedWeb = deps.webToken ? Buffer.from(deps.webToken) : null;
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Vary", "Authorization");
    if (deps.enabled !== true) return c.json({ error: "not_found" }, 404);
    await next();
  });

  async function handle(c: Context, method: "GET" | "PUT") {
    if (c.req.method !== method) {
      c.header("Allow", method);
      return c.json({ error: "invalid_request" }, 405);
    }
    const mint = c.req.param("mint");
    if (!mint || !MINT.test(mint) || new URL(c.req.url).search !== "")
      return c.json({ error: "invalid_request" }, 400);
    const credential = c.req.header("x-hyphae-web-token");
    const receivedWeb = credential && credential.length <= 4096 ? Buffer.from(credential) : null;
    const trustedWeb =
      expectedWeb &&
      receivedWeb &&
      expectedWeb.length === receivedWeb.length &&
      timingSafeEqual(expectedWeb, receivedWeb);
    const ip = trustedWeb ? c.req.header("x-hyphae-visitor") : c.req.header("fly-client-ip");
    if (!ipAllowed(ipBucketKey(ip)))
      return c.json({ error: "unavailable" }, 429, { "Retry-After": "3" });
    if (!deps.identity || !deps.telegramAdmin) return c.json({ error: "unavailable" }, 503);
    const identity = deps.identity;
    const telegramAdmin = deps.telegramAdmin;
    const auth = c.req.header("authorization");
    const token =
      auth && auth.length <= 4103
        ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(auth)?.[1]
        : undefined;
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const controller = new AbortController();
    const { signal } = controller;
    const cancel = () => controller.abort();
    c.req.raw.signal.addEventListener("abort", cancel, { once: true });
    if (c.req.raw.signal.aborted) cancel();
    const deadline = Date.now() + (deps.timeoutMs ?? 5000);
    const timer = setTimeout(cancel, Math.max(1, deadline - Date.now()));
    try {
      assertActive(signal, deadline);
      const update = method === "PUT" ? await updateBody(c.req.raw, signal) : undefined;
      let subject: string;
      try {
        subject = await within(identity.verify(token), signal);
      } catch (error) {
        if (error instanceof AdminError) throw error;
        throw new AdminError("unauthorized", 401);
      }
      if (!subjectAllowed(subject))
        return c.json({ error: "unavailable" }, 429, { "Retry-After": "3" });
      const actor = telegramIdentity(
        await within(identity.currentUser(subject, signal), signal),
        subject,
      );
      if (actor === null) throw new AdminError("forbidden", 403);
      const result = await within(
        administerCommunity(deps.db, {
          mint,
          actorId: actor,
          signal,
          deadline,
          ...(update ? { update } : {}),
          authorize: async (community, active) => {
            let verified: string;
            try {
              verified = await within(identity.verify(token), active);
            } catch (error) {
              if (error instanceof AdminError) throw error;
              throw new AdminError("unauthorized", 401);
            }
            if (verified !== subject) throw new AdminError("forbidden", 403);
            const fresh = telegramIdentity(
              await within(identity.currentUser(subject, active), active),
              subject,
            );
            if (fresh !== actor || community.adminTelegramUserId !== actor)
              throw new AdminError("forbidden", 403);
            if (!(await within(telegramAdmin(community.telegramChatId, actor, active), active)))
              throw new AdminError("forbidden", 403);
            assertActive(active);
          },
        }),
        signal,
      );
      return c.json(result);
    } catch (error) {
      if (error instanceof AdminError) return c.json({ error: error.code }, error.status);
      // Provider/driver errors can carry tokens and connection strings.
      return c.json({ error: "unavailable" }, 503);
    } finally {
      clearTimeout(timer);
      c.req.raw.signal.removeEventListener("abort", cancel);
      controller.abort();
    }
  }

  app.all("/communities/:mint", (c) => handle(c, "GET"));
  app.all("/communities/:mint/intake", (c) => handle(c, "PUT"));
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((_, c) => c.json({ error: "unavailable" }, 503));
  return app;
}
