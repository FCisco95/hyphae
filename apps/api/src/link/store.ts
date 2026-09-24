import { communities, type Db, linkSessions, walletProofRequests } from "@hyphae/db";
import type { TenantProofConfig, VerificationStore } from "@organichub/verify";
import { and, eq, isNull, sql } from "drizzle-orm";
import { applyVerifiedWallet } from "./wallet-links.js";

export interface LinkContext {
  communityId: string;
  linkSessionId: string;
  telegramUserId: bigint;
  telegramUsername: string | null;
  tenant: TenantProofConfig;
}
export type LinkRefusal = "wallet_taken" | "stale";

class Rollback extends Error {
  constructor(readonly reason: LinkRefusal) {
    super(reason);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clock = sql`clock_timestamp()`;

// Drizzle wraps driver errors, so the SQLSTATE can sit on a cause rather than the error itself.
export function sqlState(err: unknown): string | undefined {
  for (let e = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

// Bound to one authenticated link session at construction. Nothing a request body carries can
// reach the community, the Telegram user, the origin or the chain.
export function createLinkStore(db: Db, ctx: LinkContext) {
  let refusal: LinkRefusal | undefined;
  const scoped = (requestId: string) =>
    and(
      eq(walletProofRequests.requestId, requestId),
      eq(walletProofRequests.communityId, ctx.communityId),
      eq(walletProofRequests.linkSessionId, ctx.linkSessionId),
    );

  const store: VerificationStore = {
    async databaseNow() {
      const [row] = await db
        .select({
          ms: sql<number>`floor(extract(epoch from clock_timestamp()) * 1000)::double precision`,
        })
        .from(communities)
        .where(eq(communities.id, ctx.communityId));
      if (!row) throw new Error("link: community missing");
      return new Date(Number(row.ms));
    },

    async insert(input) {
      if (
        input.telegramUserId !== String(ctx.telegramUserId) ||
        input.origin !== ctx.tenant.origin ||
        input.chain !== ctx.tenant.chain
      ) {
        throw new Error("link: identity mismatch");
      }
      await db.insert(walletProofRequests).values({
        requestId: input.requestId,
        communityId: ctx.communityId,
        linkSessionId: ctx.linkSessionId,
        telegramUserId: input.telegramUserId,
        walletAddress: input.walletAddress,
        nonceHash: input.nonceHash.toString("hex"),
        origin: input.origin,
        chain: input.chain,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
      });
    },

    async findByRequestId(requestId) {
      if (!UUID.test(requestId)) return undefined;
      const [row] = await db.select().from(walletProofRequests).where(scoped(requestId));
      if (!row) return undefined;
      return {
        requestId: row.requestId,
        telegramUserId: row.telegramUserId,
        walletAddress: row.walletAddress,
        nonceHash: Buffer.from(row.nonceHash, "hex"),
        origin: row.origin,
        chain: row.chain,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
        status: row.status,
      };
    },

    // Proof, session and wallet commit together or not at all. Locks go session, then request,
    // then member; every time condition is judged by clock_timestamp() after the waits.
    async verifySignature(input) {
      refusal = undefined;
      try {
        return await db.transaction(async (tx) => {
          await tx
            .select({ id: linkSessions.id })
            .from(linkSessions)
            .where(
              and(
                eq(linkSessions.id, ctx.linkSessionId),
                eq(linkSessions.communityId, ctx.communityId),
              ),
            )
            .for("update");
          await tx
            .select({ id: walletProofRequests.requestId })
            .from(walletProofRequests)
            .where(scoped(input.requestId))
            .for("update");

          if (input.telegramUserId !== String(ctx.telegramUserId)) throw new Rollback("stale");
          const outcome = await applyVerifiedWallet(tx, {
            communityId: ctx.communityId,
            telegramUserId: ctx.telegramUserId,
            telegramUsername: ctx.telegramUsername,
            wallet: input.walletAddress,
            proofRequestId: input.requestId,
          });
          if (outcome === "wallet_taken") throw new Rollback("wallet_taken");

          const proof = await tx
            .update(walletProofRequests)
            .set({ status: "consumed", consumedAt: clock })
            .where(
              and(
                scoped(input.requestId),
                eq(walletProofRequests.telegramUserId, input.telegramUserId),
                eq(walletProofRequests.walletAddress, input.walletAddress),
                eq(walletProofRequests.nonceHash, input.nonceHash.toString("hex")),
                eq(walletProofRequests.issuedAt, input.issuedAt),
                eq(walletProofRequests.expiresAt, input.expiresAt),
                eq(walletProofRequests.origin, ctx.tenant.origin),
                eq(walletProofRequests.chain, ctx.tenant.chain),
                eq(walletProofRequests.status, "pending"),
                sql`${walletProofRequests.issuedAt} <= clock_timestamp()`,
                sql`${walletProofRequests.expiresAt} > clock_timestamp()`,
              ),
            )
            .returning({ id: walletProofRequests.requestId });
          if (proof.length !== 1) throw new Rollback("stale");

          const session = await tx
            .update(linkSessions)
            .set({ usedAt: clock })
            .where(
              and(
                eq(linkSessions.id, ctx.linkSessionId),
                eq(linkSessions.communityId, ctx.communityId),
                eq(linkSessions.telegramUserId, ctx.telegramUserId),
                isNull(linkSessions.usedAt),
                sql`${linkSessions.expiresAt} > clock_timestamp()`,
              ),
            )
            .returning({ id: linkSessions.id });
          if (session.length !== 1) throw new Rollback("stale");
          return true;
        });
      } catch (err) {
        if (err instanceof Rollback) {
          refusal = err.reason;
          return false;
        }
        // Another member linked the same wallet concurrently.
        if (sqlState(err) === "23505") {
          refusal = "wallet_taken";
          return false;
        }
        throw err; // unknown outcome, including a lost COMMIT acknowledgement; the route reconciles
      }
    },
  };
  return { store, refusal: (): LinkRefusal | undefined => refusal };
}
