import { readFile } from "node:fs/promises";
import { type Db, memberWalletLinks, walletProofRequests } from "@hyphae/db";
import {
  consumeWalletProof,
  createVerificationRequest,
  parseProjectId,
  type TenantProofConfig,
  WalletProofError,
} from "@organichub/verify";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { LinkedNote } from "./notify.js";
import { findLinkSession, resolveLinkSession } from "./session.js";
import { createLinkStore, sqlState } from "./store.js";

const Token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const RequestBody = z.strictObject({ token: Token, wallet: z.string().min(32).max(44) });
const VerifyBody = z.strictObject({
  token: Token,
  requestId: z.uuid(),
  nonce: z.string().max(64),
  message: z.string().max(2000),
  signature: z.string().max(100),
});
const StatusBody = z.strictObject({ token: Token });

type Code = "proof_rejected" | "wallet_taken" | "link_expired" | "link_unavailable";
// Fixed fields only: never the error, its cause, the body, token, nonce, message or signature.
const fail = (code: Code, op: string): { error: Code } => {
  if (code === "link_unavailable") console.error(JSON.stringify({ link: op, code }));
  return { error: code };
};

const CSP =
  "default-src 'none'; script-src 'self'; connect-src 'self'; img-src data:; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
// Built: dist/server.js serves dist/public/*. Tests and tsx run from src/link, next to page/.
const asset = (name: string) =>
  readFile(new URL(`./public/${name}`, import.meta.url)).catch(() =>
    readFile(new URL(`./page/${name}`, import.meta.url)),
  );

type Found = NonNullable<Awaited<ReturnType<typeof resolveLinkSession>>>;

// The session behind the token decides who is linking to which community; the body never does.
export function linkRoutes(deps: {
  db: Db;
  tenant: TenantProofConfig;
  storeFactory?: typeof createLinkStore;
  // Best effort after a verified link; its failure never changes the link result.
  notify?: (note: LinkedNote) => Promise<void>;
}) {
  const { db, tenant } = deps;
  const makeStore = deps.storeFactory ?? createLinkStore;
  const app = new Hono();
  app.use(
    "*",
    bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json(fail("proof_rejected", "body"), 400) }),
  );
  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
  });

  app.get("/", async (c) => {
    c.header("Content-Security-Policy", CSP);
    return c.html((await asset("index.html")).toString());
  });
  app.get("/app.js", async (c) => {
    c.header("Content-Security-Policy", CSP);
    return c.body((await asset("app.js")).toString(), 200, {
      "content-type": "text/javascript; charset=utf-8",
    });
  });

  const context = (found: Found) => ({
    ctx: {
      communityId: found.community.id,
      linkSessionId: found.session.id,
      telegramUserId: found.session.telegramUserId,
      telegramUsername: found.session.telegramUsername,
      tenant,
    },
    identity: {
      projectId: parseProjectId(found.community.id),
      userId: String(found.session.telegramUserId),
    },
  });

  app.post("/request", async (c) => {
    const body = RequestBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json(fail("proof_rejected", "request"), 400);
    const found = await resolveLinkSession(db, body.data.token);
    if (!found) return c.json(fail("link_expired", "request"), 410);
    const { ctx, identity } = context(found);
    try {
      const out = await createVerificationRequest(
        makeStore(db, ctx).store,
        identity,
        body.data.wallet,
        tenant,
      );
      return c.json({ requestId: out.requestId, nonce: out.nonce, message: out.message });
    } catch (err) {
      // The SDK refuses bad input with a plain Error; only database errors carry a SQLSTATE.
      if (sqlState(err) === undefined) return c.json(fail("proof_rejected", "request"), 400);
      return c.json(fail("link_unavailable", "request"), 503);
    }
  });

  app.post("/verify", async (c) => {
    const body = VerifyBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json(fail("proof_rejected", "verify"), 400);
    const found = await resolveLinkSession(db, body.data.token);
    if (!found) return c.json(fail("link_expired", "verify"), 410);
    const { ctx, identity } = context(found);
    const linked = makeStore(db, ctx);
    const { token: _token, ...proof } = body.data;
    try {
      await consumeWalletProof(linked.store, identity, proof, tenant);
    } catch (err) {
      if (linked.refusal() === "wallet_taken") return c.json(fail("wallet_taken", "verify"), 409);
      if (err instanceof WalletProofError) return c.json(fail("proof_rejected", "verify"), 400);
      return c.json(fail("link_unavailable", "verify"), 503);
    }
    const [row] = await db
      .select({ wallet: walletProofRequests.walletAddress })
      .from(walletProofRequests)
      .where(
        and(
          eq(walletProofRequests.requestId, proof.requestId),
          eq(walletProofRequests.communityId, ctx.communityId),
        ),
      );
    if (!row) throw new Error("link: consumed request missing");
    void Promise.resolve()
      .then(() =>
        deps.notify?.({
          telegramUserId: ctx.telegramUserId,
          communityId: ctx.communityId,
          communityName: found.community.name,
          wallet: row.wallet,
        }),
      )
      .catch(() => {});
    return c.json({ status: "linked", wallet: row.wallet });
  });

  // After an unknown outcome the page asks here: durable state is read, no effect is re-run.
  app.post("/status", async (c) => {
    const body = StatusBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json(fail("proof_rejected", "status"), 400);
    const found = await findLinkSession(db, body.data.token);
    if (!found?.session.usedAt) return c.json({ linked: false });
    const [row] = await db
      .select({ wallet: memberWalletLinks.wallet })
      .from(memberWalletLinks)
      .innerJoin(
        walletProofRequests,
        eq(walletProofRequests.requestId, memberWalletLinks.proofRequestId),
      )
      .where(
        and(
          eq(walletProofRequests.linkSessionId, found.session.id),
          eq(walletProofRequests.status, "consumed"),
          eq(memberWalletLinks.communityId, found.community.id),
        ),
      );
    return c.json(row ? { linked: true, wallet: row.wallet } : { linked: false });
  });

  return app;
}
