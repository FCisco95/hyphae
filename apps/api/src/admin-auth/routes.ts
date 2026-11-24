import {
  OperatorChallengeRequestSchema,
  OperatorInitRequestSchema,
  type OperatorSession,
  OperatorSessionRequestSchema,
  OperatorSubmitRequestSchema,
} from "@hyphae/core";
import { communities, type Db } from "@hyphae/db";
import { getBase58Encoder } from "@solana/kit";
import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { AdminError, within } from "../admin/guard.js";
import { tokenBucket } from "../member-auth/limits.js";
import type { SettleChain } from "../payout/distribution-settle.js";
import type { GateDeps } from "../payout/gate.js";
import { allowedOrigin, signedBy } from "./message.js";
import {
  buildInit,
  buildPublish,
  buildView,
  type PublishDeps,
  submitInit,
  submitPublish,
} from "./publish.js";
import { operatorOverview, operatorPayable } from "./reads.js";
import { setupRecord } from "./setup-records.js";
import type { OperatorAuthStore, OperatorSessionRecord } from "./store.js";

// The operator sign-in (roadmap item 3, part A): a challenge, an off-chain signature by the
// community's on-chain admin, and an in-memory session. Part B adds the browser publish and
// init-community behind OPERATOR_PUBLISH_ENABLED: the API builds the transaction, the admin's
// wallet signs it, and only the signature comes back. The API holds no key.

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
  // The settle loop's chain without a publisher, for the top-up figure. Absent: unavailable.
  settle?: () => Promise<SettleChain>;
  gate?: GateDeps;
  now?: () => Date;
  timeoutMs?: number;
  // Part B. true: the publish and init routes answer; absent or false: 404 disabled.
  publishEnabled?: boolean;
  // The chain the publish and init routes build and send with. Absent with the flag on: 503.
  publish?: PublishDeps;
  // How long a submit may take: the send and its confirmation, up to the blockhash's expiry.
  submitTimeoutMs?: number;
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

// Part A's exact shape for an admin session; a setup session says so.
const view = (s: OperatorSessionRecord): OperatorSession => ({
  wallet: s.wallet,
  mint: s.mint,
  expires_at: s.expiresAt.toISOString(),
  ...(s.role === "setup" ? { role: "setup" as const } : {}),
});

const EmptyRequestSchema = z.strictObject({});

export function operatorAuth(db: Db, deps: OperatorDeps) {
  const origins = deps.origins.map(allowedOrigin);
  const challengeIp = tokenBucket({ capacity: 10, refillPerMinute: 10 });
  const sessionIp = tokenBucket({ capacity: 10, refillPerMinute: 10 });
  const reads = tokenBucket({ capacity: 60, refillPerMinute: 60 });
  const builds = tokenBucket({ capacity: 6, refillPerMinute: 6 });
  const submits = tokenBucket({ capacity: 6, refillPerMinute: 6 });
  const timeoutMs = deps.timeoutMs ?? 5000;
  const publishOn = deps.publishEnabled === true;
  // A community not yet on-chain may sign in only to initialize it: part B on, and a setup
  // record (setup-records.ts) for this mint and network.
  const setupFor = (mint: string) =>
    publishOn && deps.publish ? setupRecord(deps.publish.setupRecords, mint, deps.network) : null;

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
      if (session.role === "setup") {
        // Still unbound, still recorded for this wallet: otherwise the setup session ends.
        if (
          !community ||
          community.chainAddress !== null ||
          setupFor(community.mint)?.admin !== session.wallet
        ) {
          deps.store.endWallet(session);
          throw new AdminError("forbidden", 403);
        }
        return { session, community, signal };
      }
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
      if (community.chainAddress === null && !setupFor(community.mint))
        throw new AdminError("forbidden", 403);
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
        if (community && community.chainAddress === null) {
          // A setup session: the record names this wallet as the admin-to-be.
          if (setupFor(community.mint)?.admin !== challenge.wallet)
            throw new AdminError("forbidden", 403);
          const { token, session } = deps.store.open({
            mint: community.mint,
            wallet: challenge.wallet,
            role: "setup",
          });
          return c.json({ ...view(session), token });
        }
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

    // A session reads only its own community; the reads are an admin session's.
    async function scoped(c: Context, role: OperatorSessionRecord["role"] | "any" = "admin") {
      const mint = c.req.param("mint");
      if (!mint || !/^[A-Za-z0-9]{1,64}$/.test(mint) || new URL(c.req.url).search !== "")
        throw new AdminError("invalid_request", 400);
      const auth = await authenticate(c);
      if (auth.community.mint !== mint) throw new AdminError("forbidden", 403);
      if (role !== "any" && auth.session.role !== role) throw new AdminError("forbidden", 403);
      return auth;
    }
    const reads = {
      network: deps.network,
      ...(deps.settle ? { settle: deps.settle } : {}),
      ...(deps.gate ? { gate: deps.gate } : {}),
      ...(deps.now ? { now: deps.now } : {}),
    };
    app.all("/communities/:mint/overview", async (c) => {
      const refused = only(c, "GET");
      if (refused) return refused;
      const { community, signal } = await scoped(c);
      return c.json(
        await within(
          operatorOverview(
            db,
            { ...community, chainAddress: community.chainAddress as string },
            reads,
          ),
          signal,
        ),
      );
    });
    app.all("/communities/:mint/epochs/:index/payable", async (c) => {
      const refused = only(c, "GET");
      if (refused) return refused;
      const raw = c.req.param("index");
      if (!/^(0|[1-9][0-9]{0,8})$/.test(raw)) throw new AdminError("invalid_request", 400);
      const { community, signal } = await scoped(c);
      const result = await within(
        operatorPayable(
          db,
          { ...community, chainAddress: community.chainAddress as string },
          Number(raw),
          reads,
        ),
        signal,
      );
      if (!result) throw new AdminError("not_found", 404);
      return c.json(result);
    });

    // Part B: off (or no chain to build with) before anything else is read.
    function publishing(c: Context): PublishDeps | Response {
      if (!publishOn) return c.json({ error: "disabled" }, 404);
      if (!deps.publish) return c.json({ error: "unavailable" }, 503);
      return deps.publish;
    }
    const operatorOf = (s: OperatorSessionRecord) => ({
      id: s.id,
      role: s.role,
      mint: s.mint,
      wallet: s.wallet,
    });
    // A build reads the chain and the database under a deadline. A submit may take up to the
    // blockhash's expiry: its send and its confirmation.
    const buildTimeout = Math.max(timeoutMs, 20_000);
    const submitTimeout = deps.submitTimeoutMs ?? 90_000;

    app.all("/communities/:mint/publish/status", async (c) => {
      const p = publishing(c);
      if (p instanceof Response) return p;
      const refused = only(c, "GET");
      if (refused) return refused;
      const { session } = await scoped(c, "any");
      const latest = p.builds.latest(session.id, session.mint);
      return c.json({ state: "enabled", build: latest ? buildView(latest) : null });
    });

    app.all("/communities/:mint/publish/build", async (c) => {
      const p = publishing(c);
      if (p instanceof Response) return p;
      const refused = only(c, "POST");
      if (refused) return refused;
      const { session } = await scoped(c, "admin");
      if (!builds(session.id)) throw new AdminError("unavailable", 429);
      await jsonBody(c, EmptyRequestSchema, AbortSignal.timeout(timeoutMs));
      return c.json(
        await within(buildPublish(db, p, operatorOf(session)), AbortSignal.timeout(buildTimeout)),
      );
    });

    app.all("/communities/:mint/publish/submit", async (c) => {
      const p = publishing(c);
      if (p instanceof Response) return p;
      const refused = only(c, "POST");
      if (refused) return refused;
      const { session } = await scoped(c, "admin");
      if (!submits(session.id)) throw new AdminError("unavailable", 429);
      const input = await jsonBody(c, OperatorSubmitRequestSchema, AbortSignal.timeout(timeoutMs));
      return c.json(
        await within(
          submitPublish(db, p, operatorOf(session), {
            buildId: input.build_id,
            signature: input.signature,
          }),
          AbortSignal.timeout(submitTimeout),
        ),
      );
    });

    app.all("/communities/:mint/init/build", async (c) => {
      const p = publishing(c);
      if (p instanceof Response) return p;
      const refused = only(c, "POST");
      if (refused) return refused;
      const { session } = await scoped(c, "setup");
      if (!builds(session.id)) throw new AdminError("unavailable", 429);
      const input = await jsonBody(c, OperatorInitRequestSchema, AbortSignal.timeout(timeoutMs));
      return c.json(
        await within(
          buildInit(db, p, operatorOf(session), { feeRecipient: input.fee_recipient }),
          AbortSignal.timeout(buildTimeout),
        ),
      );
    });

    app.all("/communities/:mint/init/submit", async (c) => {
      const p = publishing(c);
      if (p instanceof Response) return p;
      const refused = only(c, "POST");
      if (refused) return refused;
      const { session } = await scoped(c, "setup");
      if (!submits(session.id)) throw new AdminError("unavailable", 429);
      const input = await jsonBody(c, OperatorSubmitRequestSchema, AbortSignal.timeout(timeoutMs));
      return c.json(
        await within(
          submitInit(db, p, operatorOf(session), {
            buildId: input.build_id,
            signature: input.signature,
          }),
          AbortSignal.timeout(submitTimeout),
        ),
      );
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
