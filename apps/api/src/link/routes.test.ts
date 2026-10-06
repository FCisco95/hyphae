import { linkSessions } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { linkRoutes } from "./routes.js";
import { digestToken, openLinkSession } from "./session.js";
import { createLinkStore } from "./store.js";
import { testTenant as tenant, testWallet } from "./test-wallet.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const post = (app: ReturnType<typeof linkRoutes>, path: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function fresh(communityId?: string, telegramUserId = 77n) {
  const id = communityId ?? (await seedCommunity(t.db)).community.id;
  return openLinkSession(t.db, { communityId: id, telegramUserId, telegramUsername: "x" });
}

describe("link routes", () => {
  it("request, sign and verify link the wallet; status reports it", async () => {
    const app = linkRoutes({ db: t.db, tenant });
    const token = await fresh();
    const w = await testWallet();
    const r1 = await post(app, "/request", { token, wallet: w.address });
    expect(r1.status).toBe(200);
    expect(r1.headers.get("cache-control")).toBe("no-store");
    const req = await r1.json();

    const r2 = await post(app, "/verify", { token, ...req, signature: await w.sign(req.message) });
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ status: "linked", wallet: w.address });
    expect(await (await post(app, "/status", { token })).json()).toEqual({
      linked: true,
      wallet: w.address,
    });
  });

  it("rejects identity fields in the body (strict schema)", async () => {
    const app = linkRoutes({ db: t.db, tenant });
    const token = await fresh();
    const w = await testWallet();
    const r = await post(app, "/request", {
      token,
      wallet: w.address,
      communityId: "x",
      telegramUserId: "1",
    });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "proof_rejected" });
  });

  it("a non-base58 wallet is proof_rejected, not unavailable", async () => {
    const app = linkRoutes({ db: t.db, tenant });
    const r = await post(app, "/request", { token: await fresh(), wallet: "0".repeat(40) });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "proof_rejected" });
  });

  it("an unknown or used token is link_expired with no detail", async () => {
    const app = linkRoutes({ db: t.db, tenant });
    const w = await testWallet();
    const r = await post(app, "/request", { token: "B".repeat(43), wallet: w.address });
    expect(r.status).toBe(410);
    expect(await r.text()).toBe(JSON.stringify({ error: "link_expired" }));
  });

  it("a rewritten message is proof_rejected", async () => {
    const app = linkRoutes({ db: t.db, tenant });
    const token = await fresh();
    const w = await testWallet();
    const req = await (await post(app, "/request", { token, wallet: w.address })).json();
    const tampered = `${req.message}\n`;
    const r = await post(app, "/verify", {
      token,
      ...req,
      message: tampered,
      signature: await w.sign(tampered),
    });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "proof_rejected" });
  });

  it("a wallet another member holds is wallet_taken", async () => {
    const app = linkRoutes({ db: t.db, tenant });
    const w = await testWallet();
    const { community } = await seedCommunity(t.db);
    const first = await fresh(community.id, 77n);
    const r1 = await (await post(app, "/request", { token: first, wallet: w.address })).json();
    await post(app, "/verify", { token: first, ...r1, signature: await w.sign(r1.message) });
    const second = await fresh(community.id, 78n);
    const r2 = await (await post(app, "/request", { token: second, wallet: w.address })).json();

    const r = await post(app, "/verify", {
      token: second,
      ...r2,
      signature: await w.sign(r2.message),
    });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "wallet_taken" });
  });

  it("lost commit acknowledgement after commit: 503, then status says linked", async () => {
    const lossy: typeof createLinkStore = (db, ctx) => {
      const real = createLinkStore(db, ctx);
      return {
        ...real,
        store: {
          ...real.store,
          async verifySignature(input) {
            await real.store.verifySignature(input);
            throw new Error("connection terminated");
          },
        },
      };
    };
    const app = linkRoutes({ db: t.db, tenant, storeFactory: lossy });
    const token = await fresh();
    const w = await testWallet();
    const req = await (await post(app, "/request", { token, wallet: w.address })).json();

    const r = await post(app, "/verify", { token, ...req, signature: await w.sign(req.message) });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "link_unavailable" });
    expect(await (await post(app, "/status", { token })).json()).toEqual({
      linked: true,
      wallet: w.address,
    });
  });

  it("lost acknowledgement before commit: 503, not linked, and the session still works", async () => {
    const failing: typeof createLinkStore = (db, ctx) => {
      const real = createLinkStore(db, ctx);
      return {
        ...real,
        store: {
          ...real.store,
          async verifySignature() {
            throw new Error("connection terminated");
          },
        },
      };
    };
    const token = await fresh();
    const w = await testWallet();
    const bad = linkRoutes({ db: t.db, tenant, storeFactory: failing });
    const req = await (await post(bad, "/request", { token, wallet: w.address })).json();

    expect(
      (await post(bad, "/verify", { token, ...req, signature: await w.sign(req.message) })).status,
    ).toBe(503);
    expect(await (await post(bad, "/status", { token })).json()).toEqual({ linked: false });
    const [s] = await t.db
      .select()
      .from(linkSessions)
      .where(eq(linkSessions.tokenDigest, digestToken(token)));
    expect(s?.usedAt).toBeNull();
    const good = linkRoutes({ db: t.db, tenant });
    const again = await (await post(good, "/request", { token, wallet: w.address })).json();
    expect(
      (await post(good, "/verify", { token, ...again, signature: await w.sign(again.message) }))
        .status,
    ).toBe(200);
  });

  it("an oversized body is proof_rejected", async () => {
    const app = linkRoutes({ db: t.db, tenant });
    const r = await post(app, "/request", { token: await fresh(), wallet: "x".repeat(8_000) });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "proof_rejected" });
  });
});

describe("link confirmation message", () => {
  type Note = {
    telegramUserId: bigint;
    communityId: string;
    communityName: string;
    wallet: string;
  };
  const sign = async (
    app: ReturnType<typeof linkRoutes>,
    token: string,
    w: Awaited<ReturnType<typeof testWallet>>,
  ) => {
    const req = await (await post(app, "/request", { token, wallet: w.address })).json();
    const body = { token, ...req, signature: await w.sign(req.message) };
    return { body, response: await post(app, "/verify", body) };
  };

  it("notifies the session's own Telegram user once after a verified link", async () => {
    const notes: Note[] = [];
    const app = linkRoutes({ db: t.db, tenant, notify: async (n) => void notes.push(n) });
    const { community } = await seedCommunity(t.db);
    const token = await fresh(community.id, 4242n);
    const w = await testWallet();
    const { body, response: r } = await sign(app, token, w);
    expect(r.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(notes).toEqual([
      {
        telegramUserId: 4242n,
        communityId: community.id,
        communityName: community.name,
        wallet: w.address,
      },
    ]);
    // Reading the status afterwards, or replaying the used token, sends nothing more.
    await post(app, "/status", { token });
    expect((await post(app, "/verify", body)).status).toBe(410);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(notes).toHaveLength(1);
  });

  it("a failing notification never changes the link result", async () => {
    const app = linkRoutes({
      db: t.db,
      tenant,
      notify: async () => {
        throw new Error("telegram down");
      },
    });
    const token = await fresh();
    const w = await testWallet();
    const { response: r } = await sign(app, token, w);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "linked", wallet: w.address });
  });

  it("sends nothing for a refused proof", async () => {
    const notes: Note[] = [];
    const app = linkRoutes({ db: t.db, tenant, notify: async (n) => void notes.push(n) });
    const token = await fresh();
    const w = await testWallet();
    const req = await (await post(app, "/request", { token, wallet: w.address })).json();
    const tampered = `${req.message}\n`;
    const r = await post(app, "/verify", {
      token,
      ...req,
      message: tampered,
      signature: await w.sign(tampered),
    });
    expect(r.status).toBe(400);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(notes).toEqual([]);
  });
});
