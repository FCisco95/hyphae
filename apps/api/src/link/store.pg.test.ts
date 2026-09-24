import { randomInt, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { communities, createDb, linkSessions, members, walletProofRequests } from "@hyphae/db";
import { consumeWalletProof, createVerificationRequest, parseProjectId } from "@organichub/verify";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rubric } from "../rewards/test-db.js";
import { openLinkSession, resolveLinkSession } from "./session.js";
import { createLinkStore, type LinkContext } from "./store.js";
import { testTenant as tenant, testWallet } from "./test-wallet.js";

// Six independent pools against a disposable Postgres 17 (scripts/test-pg.sh). Races are
// asserted on final rows, repeated, never on timing.
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const a = createDb(url);
const b = createDb(url);
const c = createDb(url);
const pools = [a, b, c, createDb(url), createDb(url), createDb(url)];
const ROUNDS = 20;

beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all(pools.map((p) => p.$client.end()));
});

// Random identities: this file shares the database with the other pg suites.
async function community() {
  const [row] = await a
    .insert(communities)
    .values({
      mint: `Mint-${randomUUID()}`,
      name: "Race",
      telegramChatId: -BigInt(randomInt(1, 2 ** 47)),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!row) throw new Error("seed: community");
  return row;
}

async function session(communityId: string, userId: bigint) {
  const token = await openLinkSession(a, {
    communityId,
    telegramUserId: userId,
    telegramUsername: null,
  });
  const found = await resolveLinkSession(a, token);
  if (!found) throw new Error("session");
  const ctx: LinkContext = {
    communityId,
    linkSessionId: found.session.id,
    telegramUserId: userId,
    telegramUsername: null,
    tenant,
  };
  return { ctx, identity: { projectId: parseProjectId(communityId), userId: String(userId) } };
}

describe("proof consumption races", () => {
  it("six concurrent submissions of one valid proof commit exactly one link", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const { id } = await community();
      const { ctx, identity } = await session(id, 1000n);
      const w = await testWallet();
      const req = await createVerificationRequest(
        createLinkStore(a, ctx).store,
        identity,
        w.address,
        tenant,
      );
      const proof = { ...req, signature: await w.sign(req.message) };

      const results = await Promise.allSettled(
        pools.map((p) =>
          consumeWalletProof(createLinkStore(p, ctx).store, identity, proof, tenant),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await a.select().from(members).where(eq(members.communityId, id))).toHaveLength(1);
    }
  });

  it("a proof that expires while waiting for the session lock loses", async () => {
    const { id } = await community();
    const { ctx, identity } = await session(id, 2000n);
    const w = await testWallet();
    const store = createLinkStore(a, ctx).store;
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    // Shift the whole 5-minute window so it ends 1.5 s from now; now() is one instant per
    // statement, so the lifetime check still holds.
    await a
      .update(walletProofRequests)
      .set({
        issuedAt: sql`date_trunc('milliseconds', now()) - interval '5 minutes' + interval '1500 milliseconds'`,
        expiresAt: sql`date_trunc('milliseconds', now()) + interval '1500 milliseconds'`,
      })
      .where(eq(walletProofRequests.requestId, req.requestId));
    const row = await store.findByRequestId(req.requestId);
    if (!row) throw new Error("request");

    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let locked!: () => void;
    const held = new Promise<void>((r) => {
      locked = r;
    });
    const holder = b.transaction(async (tx) => {
      await tx
        .select()
        .from(linkSessions)
        .where(eq(linkSessions.id, ctx.linkSessionId))
        .for("update");
      locked();
      await gate;
    });
    await held;
    const attempt = createLinkStore(c, ctx).store.verifySignature({
      requestId: req.requestId,
      telegramUserId: identity.userId,
      walletAddress: w.address,
      nonceHash: row.nonceHash,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
    });
    await new Promise((r) => setTimeout(r, 2500));
    release();
    await holder;

    expect(await attempt).toBe(false);
    expect(await a.select().from(members).where(eq(members.communityId, id))).toHaveLength(0);
  });

  it("two members racing for one wallet: one links, the other gets wallet_taken", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const { id } = await community();
      const w = await testWallet();
      const runs = [3000n, 3001n].map(async (uid, i) => {
        const { ctx, identity } = await session(id, uid);
        const linked = createLinkStore(i === 0 ? a : b, ctx);
        const req = await createVerificationRequest(linked.store, identity, w.address, tenant);
        const proof = { ...req, signature: await w.sign(req.message) };
        return consumeWalletProof(linked.store, identity, proof, tenant).then(
          () => "linked",
          () => linked.refusal(),
        );
      });
      expect((await Promise.all(runs)).sort()).toEqual(["linked", "wallet_taken"]);
    }
  });
});
