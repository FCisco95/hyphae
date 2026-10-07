import { linkSessions, members, memberWalletLinks, walletProofRequests } from "@hyphae/db";
import {
  consumeWalletProof,
  createVerificationRequest,
  parseProjectId,
  WalletProofError,
} from "@organichub/verify";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureMember } from "../member-journey/ensure-member.js";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { openLinkSession, resolveLinkSession } from "./session.js";
import { createLinkStore, type LinkContext } from "./store.js";
import { testTenant as tenant, testWallet } from "./test-wallet.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

async function sessionFor(communityId: string, userId: bigint) {
  const token = await openLinkSession(t.db, {
    communityId,
    telegramUserId: userId,
    telegramUsername: "u",
  });
  const found = await resolveLinkSession(t.db, token);
  if (!found) throw new Error("session");
  const ctx: LinkContext = {
    communityId,
    linkSessionId: found.session.id,
    telegramUserId: userId,
    telegramUsername: "u",
    tenant,
  };
  return { ctx, identity: { projectId: parseProjectId(communityId), userId: String(userId) } };
}

async function session(userId = 100n) {
  const { community } = await seedCommunity(t.db);
  return { community, ...(await sessionFor(community.id, userId)) };
}

const proofRow = async (requestId: string) =>
  (
    await t.db
      .select()
      .from(walletProofRequests)
      .where(eq(walletProofRequests.requestId, requestId))
  )[0];
const sessionRow = async (id: string) =>
  (await t.db.select().from(linkSessions).where(eq(linkSessions.id, id)))[0];
const holders = (wallet: string) => t.db.select().from(members).where(eq(members.wallet, wallet));

describe("tenant-bound store through the SDK", () => {
  it("links a proven wallet, consuming proof and session and writing history", async () => {
    const { community, ctx, identity } = await session();
    const w = await testWallet();
    const { store } = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    const out = await consumeWalletProof(
      store,
      identity,
      { ...req, signature: await w.sign(req.message) },
      tenant,
    );

    expect(out).toEqual({ status: "signature_verified" });
    const [m] = await t.db
      .select()
      .from(members)
      .where(and(eq(members.communityId, community.id), eq(members.telegramUserId, 100n)));
    expect(m).toMatchObject({ wallet: w.address, linkMethod: "signature", telegramUsername: "u" });
    const history = await t.db
      .select()
      .from(memberWalletLinks)
      .where(eq(memberWalletLinks.memberId, m?.id ?? ""));
    expect(history).toEqual([
      expect.objectContaining({
        wallet: w.address,
        method: "signature",
        proofRequestId: req.requestId,
        validTo: null,
      }),
    ]);
    expect((await proofRow(req.requestId))?.status).toBe("consumed");
    expect((await sessionRow(ctx.linkSessionId))?.usedAt).not.toBeNull();
  });

  it("rejects a replay of the winning proof", async () => {
    const { ctx, identity } = await session();
    const w = await testWallet();
    const { store } = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    const proof = { ...req, signature: await w.sign(req.message) };
    await consumeWalletProof(store, identity, proof, tenant);

    await expect(consumeWalletProof(store, identity, proof, tenant)).rejects.toBeInstanceOf(
      WalletProofError,
    );
  });

  it("refuses a signature from another key, leaving proof pending and session open", async () => {
    const { ctx, identity } = await session();
    const w = await testWallet();
    const other = await testWallet();
    const { store } = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);

    await expect(
      consumeWalletProof(
        store,
        identity,
        { ...req, signature: await other.sign(req.message) },
        tenant,
      ),
    ).rejects.toBeInstanceOf(WalletProofError);
    expect((await proofRow(req.requestId))?.status).toBe("pending");
    expect((await sessionRow(ctx.linkSessionId))?.usedAt).toBeNull();
  });

  it("a request from another community is absent, not forbidden", async () => {
    const a = await session(1n);
    const b = await session(1n);
    const w = await testWallet();
    const req = await createVerificationRequest(
      createLinkStore(t.db, a.ctx).store,
      a.identity,
      w.address,
      tenant,
    );

    expect(await createLinkStore(t.db, b.ctx).store.findByRequestId(req.requestId)).toBeUndefined();
  });

  it("a request made in one member's link session cannot be consumed through another's", async () => {
    const { community, ctx, identity } = await session(10n);
    const w = await testWallet();
    const req = await createVerificationRequest(
      createLinkStore(t.db, ctx).store,
      identity,
      w.address,
      tenant,
    );
    const intruder = await sessionFor(community.id, 11n);

    await expect(
      consumeWalletProof(
        createLinkStore(t.db, intruder.ctx).store,
        intruder.identity,
        { ...req, signature: await w.sign(req.message) },
        tenant,
      ),
    ).rejects.toBeInstanceOf(WalletProofError);
    expect(await holders(w.address)).toHaveLength(0);
  });

  it("refuses a wallet another member holds (D2), consuming nothing", async () => {
    const { community, ctx, identity } = await session(5n);
    const w = await testWallet();
    await t.db.insert(members).values({
      communityId: community.id,
      telegramUserId: 6n,
      wallet: w.address,
      linkMethod: "paste",
    });
    const linked = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(linked.store, identity, w.address, tenant);

    await expect(
      consumeWalletProof(
        linked.store,
        identity,
        { ...req, signature: await w.sign(req.message) },
        tenant,
      ),
    ).rejects.toBeInstanceOf(WalletProofError);
    expect(linked.refusal()).toBe("wallet_taken");
    expect((await proofRow(req.requestId))?.status).toBe("pending");
    expect((await sessionRow(ctx.linkSessionId))?.usedAt).toBeNull();
  });

  it("a snapshot field that differs from the stored request links nothing", async () => {
    const { ctx, identity } = await session();
    const w = await testWallet();
    const { store } = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    const row = await store.findByRequestId(req.requestId);
    if (!row) throw new Error("request");

    const ok = await store.verifySignature({
      requestId: req.requestId,
      telegramUserId: identity.userId,
      walletAddress: w.address,
      nonceHash: Buffer.alloc(32),
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
    });
    expect(ok).toBe(false);
    expect(await holders(w.address)).toHaveLength(0);
  });

  it("a relink closes the old history row and opens a new one", async () => {
    const { community, ctx, identity } = await session(9n);
    const first = await testWallet();
    const s1 = createLinkStore(t.db, ctx).store;
    const r1 = await createVerificationRequest(s1, identity, first.address, tenant);
    await consumeWalletProof(
      s1,
      identity,
      { ...r1, signature: await first.sign(r1.message) },
      tenant,
    );
    const again = await sessionFor(community.id, 9n);
    const s2 = createLinkStore(t.db, again.ctx).store;
    const second = await testWallet();
    const r2 = await createVerificationRequest(s2, identity, second.address, tenant);
    await consumeWalletProof(
      s2,
      identity,
      { ...r2, signature: await second.sign(r2.message) },
      tenant,
    );

    const rows = await t.db
      .select()
      .from(memberWalletLinks)
      .where(eq(memberWalletLinks.communityId, community.id));
    expect(rows.filter((r) => r.validTo === null).map((r) => r.wallet)).toEqual([second.address]);
    const old = rows.find((r) => r.wallet === first.address);
    const current = rows.find((r) => r.wallet === second.address);
    expect(old?.validTo?.getTime()).toBeLessThanOrEqual(current?.validFrom.getTime() ?? 0);
  });

  it("a member who earned before linking links a wallet and keeps the same member", async () => {
    const { community } = await seedCommunity(t.db);
    const earner = await ensureMember(t.db, {
      communityId: community.id,
      telegramUserId: 777n,
      telegramUsername: null,
    });
    const { ctx, identity } = await sessionFor(community.id, 777n);
    const w = await testWallet();
    const { store } = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    await consumeWalletProof(
      store,
      identity,
      { ...req, signature: await w.sign(req.message) },
      tenant,
    );

    const [row] = await t.db.select().from(members).where(eq(members.id, earner.id));
    expect(row?.wallet).toBe(w.address);
    expect(row?.linkMethod).toBe("signature");
    expect(row?.linkedAt).toBeInstanceOf(Date);
    const links = await t.db
      .select()
      .from(memberWalletLinks)
      .where(eq(memberWalletLinks.memberId, earner.id));
    expect(links.map((r) => [r.wallet, r.method, r.validTo])).toEqual([
      [w.address, "signature", null],
    ]);
  });

  it("verifying a pasted member closes the pasted row", async () => {
    const { community, member } = await seedCommunity(t.db);
    await t.db.insert(memberWalletLinks).values({
      communityId: community.id,
      memberId: member.id,
      wallet: member.wallet as string,
      method: "paste",
      validFrom: member.linkedAt as Date,
    });
    const { ctx, identity } = await sessionFor(community.id, member.telegramUserId);
    const w = await testWallet();
    const { store } = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    await consumeWalletProof(
      store,
      identity,
      { ...req, signature: await w.sign(req.message) },
      tenant,
    );

    const rows = await t.db
      .select()
      .from(memberWalletLinks)
      .where(eq(memberWalletLinks.memberId, member.id));
    expect(rows.map((r) => [r.method, r.validTo === null]).sort()).toEqual([
      ["paste", false],
      ["signature", true],
    ]);
  });

  it("a link session that expired before signing leaves proof pending and links nothing", async () => {
    const { ctx, identity } = await session();
    const w = await testWallet();
    const { store } = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    await t.db
      .update(linkSessions)
      .set({ expiresAt: sql`clock_timestamp() - interval '1 millisecond'` })
      .where(eq(linkSessions.id, ctx.linkSessionId));

    await expect(
      consumeWalletProof(store, identity, { ...req, signature: await w.sign(req.message) }, tenant),
    ).rejects.toBeInstanceOf(WalletProofError);
    expect((await proofRow(req.requestId))?.status).toBe("pending");
    expect(await holders(w.address)).toHaveLength(0);
  });

  it("a proof checked against another origin or chain is rejected with no mutation", async () => {
    const { ctx, identity } = await session();
    const w = await testWallet();
    const { store } = createLinkStore(t.db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    const proof = { ...req, signature: await w.sign(req.message) };

    for (const other of [
      { ...tenant, origin: "https://evil.hyphae.test" },
      { ...tenant, chain: "solana:devnet" as const },
    ]) {
      await expect(consumeWalletProof(store, identity, proof, other)).rejects.toBeInstanceOf(
        WalletProofError,
      );
    }
    expect((await proofRow(req.requestId))?.status).toBe("pending");
    expect((await sessionRow(ctx.linkSessionId))?.usedAt).toBeNull();
    expect(await holders(w.address)).toHaveLength(0);
  });
});
