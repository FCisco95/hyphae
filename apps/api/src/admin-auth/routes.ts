import {
  OperatorChallengeRequestSchema,
  type OperatorSession,
  OperatorSessionRequestSchema,
} from "@hyphae/core";
import { communities, type Db } from "@hyphae/db";
import { getBase58Encoder } from "@solana/kit";
import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import type { z } from "zod";
import { AdminError, within } from "../admin/guard.js";
import { tokenBucket } from "../member-auth/limits.js";
import { allowedOrigin, signedBy } from "./message.js";
import type { OperatorAuthStore, OperatorSessionRecord } from "./store.js";

// The operator sign-in (roadmap item 3, part A): a challenge, an off-chain signature by the
// community's on-chain admin, and an in-memory session. Read-only: no key, no transaction.

const MAX_BODY_BYTES = 1024;
const TOKEN = /^Bearer (hop_[A-Za-z0-9_-]{43})$/;

export interface OperatorDeps {
  store: OperatorAuthStore;
  // Origins a sign-in may name; new challenges use the first.
  origins: readonly string[];
  network: "solana:mainnet" | "solana:devnet";
  // The admin key of the community account at the bound address, or null when there is no such
  // community for this mint. Throws when the chain cannot be read: that is never a pass.
  onChainAdmin: (input: { mint: string; address: string }) => Promise<string | null>;
  timeoutMs?: number;
}

export interface OperatorContext {
  session: OperatorSessionRecord;
  community: typeof communities.$inferSelect;
  signal: AbortSignal;
}

// Bounded in bytes and in time: a slow body cannot hold the handler open.
async function jsonBody<T extends z.ZodType>(
  c: Context,
  schema: T,
  signal: AbortSignal,
): Promise<z.infer<T>> {
  const request = c.req.raw;
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
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AdminError("invalid_request", 400);
    return parsed.data;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof AdminError) throw error;
    throw new AdminError("invalid_request", 400);
  } finally {
    reader.releaseLock();
  }
}

const view = (s: OperatorSessionRecord): OperatorSession => ({
  wallet: s.wallet,
  mint: s.mint,
  expires_at: s.expiresAt.toISOString(),
});

export function operatorAuth(db: Db, deps: OperatorDeps) {
  const origins = deps.origins.map(allowedOrigin);
  const challengeIp = tokenBucket({ capacity: 10, refillPerMinute: 10 });
  const sessionIp = tokenBucket({ capacity: 10, refillPerMinute: 10 });
  const reads = tokenBucket({ capacity: 60, refillPerMinute: 60 });
  const timeoutMs = deps.timeoutMs ?? 5000;

  async function bound(mint: string) {
    const [community] = await db.select().from(communities).where(eq(communities.mint, mint));
    return community ?? null;
  }

  // The current on-chain admin of the community, under a deadline. A chain error is 503.
  async function adminOf(community: { mint: string; chainAddress: string }, signal: AbortSignal) {
    try {
      return await within(
        deps.onChainAdmin({ mint: community.mint, address: community.chainAddress }),
        signal,
      );
    } catch {
      throw new AdminError("unavailable", 503);
    }
  }

  async function guarded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const signal = AbortSignal.timeout(timeoutMs);
    return work(signal);
  }

  // Every operator read: a live session, a read budget, and the wallet still the community's
  // on-chain admin. A rotated admin ends the wallet's sessions for that community.
  async function authenticate(c: Context): Promise<OperatorContext> {
    const header = c.req.header("authorization");
    const token = header && header.length <= 100 ? TOKEN.exec(header)?.[1] : undefined;
    if (!token) throw new AdminError("unauthorized", 401);
    const session = deps.store.session(token);
    if (!session) throw new AdminError("unauthorized", 401);
    if (!reads(token)) throw new AdminError("unavailable", 429);
    return guarded(async (signal) => {
      const community = await within(bound(session.mint), signal);
      if (!community || community.chainAddress === null) {
        deps.store.endWallet(session);
        throw new AdminError("forbidden", 403);
      }
      const admin = await adminOf(
        { mint: community.mint, chainAddress: community.chainAddress },
        signal,
      );
      if (admin !== session.wallet) {
        deps.store.endWallet(session);
        throw new AdminError("forbidden", 403);
      }
      return { session, community, signal };
    });
  }

  function routes(visitor: (c: Context) => string) {
    const app = new Hono();
    const only = (c: Context, method: string) => {
      if (c.req.method === method) return null;
      c.header("Allow", method);
      return c.json({ error: "invalid_request" }, 405);
    };

    app.all("/status", (c) => only(c, "GET") ?? c.json({ state: "enabled" }));

    app.all("/challenge", async (c) => {
      const refused = only(c, "POST");
      if (refused) return refused;
      if (!challengeIp(visitor(c))) throw new AdminError("unavailable", 429);
      // No per-wallet budget: anyone could spend it to lock the admin out. Issuing costs one
      // database read and no chain call; the per-IP budget and the open-challenge cap bound it.
      const input = await jsonBody(
        c,
        OperatorChallengeRequestSchema,
        AbortSignal.timeout(timeoutMs),
      );
      const community = await guarded((signal) => within(bound(input.mint), signal));
      if (!community) throw new AdminError("not_found", 404);
      if (community.chainAddress === null) throw new AdminError("forbidden", 403);
      const domain = origins[0];
      if (!domain) throw new AdminError("unavailable", 503);
      const challenge = deps.store.issue({
        domain,
        network: deps.network,
        mint: community.mint,
        wallet: input.wallet,
      });
      if (!challenge) throw new AdminError("unavailable", 503);
      return c.json({
        challenge_id: challenge.id,
        message: challenge.message,
        expires_at: challenge.expiresAt.toISOString(),
      });
    });

    app.all("/session", async (c) => {
      if (c.req.method === "GET") return c.json(view((await authenticate(c)).session));
      if (c.req.method === "DELETE") {
        const token = TOKEN.exec(c.req.header("authorization") ?? "")?.[1];
        if (!token || !deps.store.end(token)) throw new AdminError("unauthorized", 401);
        return c.json({ ended: true });
      }
      if (c.req.method !== "POST") {
        c.header("Allow", "GET, POST, DELETE");
        return c.json({ error: "invalid_request" }, 405);
      }
      if (!sessionIp(visitor(c))) throw new AdminError("unavailable", 429);
      const input = await jsonBody(c, OperatorSessionRequestSchema, AbortSignal.timeout(timeoutMs));
      // Taken first: whatever happens next, this challenge is spent.
      const challenge = deps.store.take(input.challenge_id);
      if (!challenge) throw new AdminError("unauthorized", 401);
      if (!origins.includes(challenge.domain) || challenge.network !== deps.network)
        throw new AdminError("unauthorized", 401);
      let signature: ReturnType<ReturnType<typeof getBase58Encoder>["encode"]>;
      try {
        signature = getBase58Encoder().encode(input.signature);
      } catch {
        throw new AdminError("unauthorized", 401);
      }
      if (!signedBy(challenge.message, signature, challenge.wallet))
        throw new AdminError("unauthorized", 401);
      return guarded(async (signal) => {
        const community = await within(bound(challenge.mint), signal);
        if (!community || community.chainAddress === null) throw new AdminError("forbidden", 403);
        const admin = await adminOf(
          { mint: community.mint, chainAddress: community.chainAddress },
          signal,
        );
        if (admin !== challenge.wallet) throw new AdminError("forbidden", 403);
        const { token, session } = deps.store.open({
          mint: community.mint,
          wallet: challenge.wallet,
        });
        return c.json({ ...view(session), token });
      });
    });

    app.notFound((c) => c.json({ error: "not_found" }, 404));
    app.onError((error, c) =>
      error instanceof AdminError
        ? c.json(
            { error: error.code },
            error.status,
            error.status === 429 ? { "Retry-After": "10" } : {},
          )
        : c.json({ error: "unavailable" }, 503),
    );
    return app;
  }

  return { authenticate, routes };
}
