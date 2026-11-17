import {
  OperatorChallengeSchema,
  OperatorSessionCreatedSchema,
  OperatorSessionSchema,
} from "@hyphae/core";
import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminRoutes } from "../admin/routes.js";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { operatorAuthStore } from "./store.js";
import { testKey } from "./test-key.js";

const ORIGIN = "https://hyphae.test";
const CHAIN_ADDRESS = "CommunityAcct1111111111111111111111";
let database: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  database = await createTestDb();
});
afterAll(async () => {
  await database.close();
});

async function boundCommunity(chainAddress: string | null = CHAIN_ADDRESS) {
  const { community } = await seedCommunity(database.db);
  await database.db
    .update(communities)
    .set({ chainAddress })
    .where(eq(communities.id, community.id));
  return community;
}

function fixture(
  options: {
    enabled?: boolean;
    admin?: () => string | null | Promise<string | null>;
    origins?: string[];
    clock?: { now: () => number };
    store?: ReturnType<typeof operatorAuthStore>;
  } = {},
) {
  const calls = { chain: 0, addresses: [] as string[] };
  const store = options.store ?? operatorAuthStore(options.clock ? { now: options.clock.now } : {});
  const app = adminRoutes({
    db: database.db,
    enabled: options.enabled ?? true,
    operator: {
      store,
      origins: options.origins ?? [ORIGIN],
      network: "solana:devnet",
      onChainAdmin: async ({ address }) => {
        calls.chain++;
        calls.addresses.push(address);
        return options.admin ? options.admin() : null;
      },
    },
  });
  return { app, calls, store };
}

const post = (app: ReturnType<typeof adminRoutes>, path: string, body: unknown, ip = "9.9.9.9") =>
  app.request(`/operator/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "fly-client-ip": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const get = (app: ReturnType<typeof adminRoutes>, path: string, token?: string) =>
  app.request(`/operator/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

async function json(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  return response.json();
}

async function signIn(
  app: ReturnType<typeof adminRoutes>,
  mint: string,
  key = testKey(),
  sign: (message: string) => string = key.signRaw,
) {
  const challenge = OperatorChallengeSchema.parse(
    await json(await post(app, "challenge", { mint, wallet: key.wallet }), 200),
  );
  const response = await post(app, "session", {
    challenge_id: challenge.challenge_id,
    signature: sign(challenge.message),
  });
  return { challenge, response, key };
}

describe("operator sign-in, disabled", () => {
  it("answers disabled on every operator route and never reads the chain", async () => {
    const community = await boundCommunity();
    const { app, calls } = fixture({ enabled: false });
    for (const response of [
      await get(app, "status"),
      await post(app, "challenge", { mint: community.mint, wallet: testKey().wallet }),
      await post(app, "session", { challenge_id: crypto.randomUUID(), signature: "1".repeat(88) }),
      await get(app, "session", `hop_${"A".repeat(43)}`),
    ])
      expect(await json(response, 404)).toEqual({ error: "disabled" });
    expect(calls.chain).toBe(0);
    // The older community routes keep their contract.
    expect(await json(await app.request(`/communities/${community.mint}`), 404)).toEqual({
      error: "not_found",
    });
    // No operator deps at all: still disabled, not a crash.
    const bare = adminRoutes({ db: database.db, enabled: false });
    expect(await json(await bare.request("/operator/status"), 404)).toEqual({ error: "disabled" });
  });

  it("is unavailable, not open, when enabled without operator deps", async () => {
    const app = adminRoutes({ db: database.db, enabled: true });
    expect(await json(await app.request("/operator/status"), 503)).toEqual({
      error: "unavailable",
    });
  });
});

describe("operator sign-in", () => {
  it("lets the on-chain admin in, bound to the community, and reads the bound address", async () => {
    const community = await boundCommunity();
    const key = testKey();
    const { app, calls } = fixture({ admin: () => key.wallet });
    expect(await json(await get(app, "status"), 200)).toEqual({ state: "enabled" });
    const { challenge, response } = await signIn(app, community.mint, key);
    expect(challenge.message).toContain(`Domain: ${ORIGIN};`);
    expect(challenge.message).toContain(`Community: ${community.mint};`);
    expect(challenge.message).toContain("Network: solana:devnet;");
    const created = OperatorSessionCreatedSchema.parse(await json(response, 200));
    expect(created).toMatchObject({ wallet: key.wallet, mint: community.mint });
    expect(calls.addresses).toEqual([CHAIN_ADDRESS]);
    const session = OperatorSessionSchema.parse(
      await json(await get(app, "session", created.token), 200),
    );
    expect(session).toEqual({
      wallet: key.wallet,
      mint: community.mint,
      expires_at: created.expires_at,
    });
  });

  it("refuses a valid signature by a wallet that is not the on-chain admin", async () => {
    const community = await boundCommunity();
    const { app } = fixture({ admin: () => testKey().wallet });
    const { response } = await signIn(app, community.mint);
    expect(await json(response, 403)).toEqual({ error: "forbidden" });
  });

  it("refuses when the community account is missing on-chain, and fails closed on a chain error", async () => {
    const community = await boundCommunity();
    expect(
      await json((await signIn(fixture({ admin: () => null }).app, community.mint)).response, 403),
    ).toEqual({ error: "forbidden" });
    const broken = fixture({
      admin: () => {
        throw new Error("rpc https://secret.example/key down");
      },
    });
    const { response } = await signIn(broken.app, community.mint);
    const body = await json(response, 503);
    expect(body).toEqual({ error: "unavailable" });
  });

  it("refuses a replayed challenge, even after a successful sign-in", async () => {
    const community = await boundCommunity();
    const key = testKey();
    const { app } = fixture({ admin: () => key.wallet });
    const { challenge, response } = await signIn(app, community.mint, key);
    expect(response.status).toBe(200);
    const replay = await post(app, "session", {
      challenge_id: challenge.challenge_id,
      signature: key.signRaw(challenge.message),
    });
    expect(await json(replay, 401)).toEqual({ error: "unauthorized" });
  });

  it("burns a challenge on a failed attempt: a correct signature afterwards is refused", async () => {
    const community = await boundCommunity();
    const key = testKey();
    const { app } = fixture({ admin: () => key.wallet });
    const challenge = OperatorChallengeSchema.parse(
      await json(await post(app, "challenge", { mint: community.mint, wallet: key.wallet }), 200),
    );
    const wrong = await post(app, "session", {
      challenge_id: challenge.challenge_id,
      signature: testKey().signRaw(challenge.message),
    });
    expect(await json(wrong, 401)).toEqual({ error: "unauthorized" });
    const right = await post(app, "session", {
      challenge_id: challenge.challenge_id,
      signature: key.signRaw(challenge.message),
    });
    expect(await json(right, 401)).toEqual({ error: "unauthorized" });
  });

  it("refuses an expired challenge", async () => {
    const community = await boundCommunity();
    const key = testKey();
    let t = Date.parse("2026-11-17T12:00:00.000Z");
    const { app } = fixture({ admin: () => key.wallet, clock: { now: () => t } });
    const challenge = OperatorChallengeSchema.parse(
      await json(await post(app, "challenge", { mint: community.mint, wallet: key.wallet }), 200),
    );
    t += 5 * 60_000;
    const late = await post(app, "session", {
      challenge_id: challenge.challenge_id,
      signature: key.signRaw(challenge.message),
    });
    expect(await json(late, 401)).toEqual({ error: "unauthorized" });
  });

  it("refuses a signature over another domain's message and a domain no longer allowed", async () => {
    const community = await boundCommunity();
    const key = testKey();
    const store = operatorAuthStore();
    const { app } = fixture({ admin: () => key.wallet, store });
    const forged = await signIn(app, community.mint, key, (message) =>
      key.signRaw(message.replaceAll("hyphae.test", "evil.test")),
    );
    expect(await json(forged.response, 401)).toEqual({ error: "unauthorized" });
    // Issued for hyphae.test, consumed by a server that no longer allows it.
    const challenge = OperatorChallengeSchema.parse(
      await json(await post(app, "challenge", { mint: community.mint, wallet: key.wallet }), 200),
    );
    const moved = fixture({ admin: () => key.wallet, store, origins: ["https://other.test"] });
    const response = await post(moved.app, "session", {
      challenge_id: challenge.challenge_id,
      signature: key.signRaw(challenge.message),
    });
    expect(await json(response, 401)).toEqual({ error: "unauthorized" });
    expect(moved.calls.chain).toBe(0);
  });

  it("checks the signature before any chain read", async () => {
    const community = await boundCommunity();
    const { app, calls } = fixture({ admin: () => testKey().wallet });
    const { response } = await signIn(app, community.mint, testKey(), () => testKey().signRaw("x"));
    expect(response.status).toBe(401);
    expect(calls.chain).toBe(0);
  });

  it("refuses unknown and unbound communities and malformed input", async () => {
    const { app } = fixture();
    const unbound = await boundCommunity(null);
    const wallet = testKey().wallet;
    expect(await json(await post(app, "challenge", { mint: "NoSuchMint", wallet }), 404)).toEqual({
      error: "not_found",
    });
    expect(await json(await post(app, "challenge", { mint: unbound.mint, wallet }), 403)).toEqual({
      error: "forbidden",
    });
    for (const body of [
      "{",
      { mint: unbound.mint },
      { mint: unbound.mint, wallet: "0OIl" },
      { mint: unbound.mint, wallet, extra: 1 },
      JSON.stringify({ mint: "M", wallet: "x".repeat(2000) }),
    ])
      expect((await post(app, "challenge", body)).status).toBe(400);
    const plain = await app.request("/operator/challenge", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ mint: unbound.mint, wallet }),
    });
    expect(plain.status).toBe(400);
    expect((await get(app, "challenge")).status).toBe(405);
    expect((await post(app, "session", { challenge_id: "nope", signature: "1" })).status).toBe(400);
  });

  it("rate-limits challenges per IP, never per wallet (no one can lock the admin out)", async () => {
    const community = await boundCommunity();
    const { app } = fixture();
    const wallet = testKey().wallet;
    const statuses = [];
    for (let i = 0; i < 8; i++)
      statuses.push(
        (await post(app, "challenge", { mint: community.mint, wallet }, `10.0.0.${i}`)).status,
      );
    expect(statuses.every((s) => s === 200)).toBe(true);
    const ip = [];
    for (let i = 0; i < 11; i++)
      ip.push(
        (
          await post(
            app,
            "challenge",
            { mint: community.mint, wallet: testKey().wallet },
            "10.1.1.1",
          )
        ).status,
      );
    expect(ip.at(-1)).toBe(429);
    expect(ip.slice(0, 10).every((s) => s === 200)).toBe(true);
  });

  it("rate-limits sign-in attempts per IP", async () => {
    const { app } = fixture();
    const statuses = [];
    for (let i = 0; i < 11; i++)
      statuses.push(
        (
          await post(
            app,
            "session",
            { challenge_id: crypto.randomUUID(), signature: "1".repeat(88) },
            "10.2.2.2",
          )
        ).status,
      );
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("gives up on a body that never finishes", async () => {
    const community = await boundCommunity();
    const app = adminRoutes({
      db: database.db,
      enabled: true,
      operator: {
        store: operatorAuthStore(),
        origins: [ORIGIN],
        network: "solana:devnet",
        onChainAdmin: async () => null,
        timeoutMs: 50,
      },
    });
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`{"mint":"${community.mint}"`));
      },
    });
    const response = await app.request("/operator/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      // @ts-expect-error Node's fetch needs duplex for a streamed body.
      duplex: "half",
    });
    expect(response.status).toBe(503);
  });
});

describe("operator sessions", () => {
  it("re-reads the on-chain admin on every request and ends the session when it changed", async () => {
    const community = await boundCommunity();
    const key = testKey();
    let admin = key.wallet;
    const { app } = fixture({ admin: () => admin });
    const { response } = await signIn(app, community.mint, key);
    const { token } = OperatorSessionCreatedSchema.parse(await json(response, 200));
    expect((await get(app, "session", token)).status).toBe(200);
    admin = testKey().wallet;
    expect(await json(await get(app, "session", token), 403)).toEqual({ error: "forbidden" });
    admin = key.wallet;
    // Rotated away once: the session is gone for good.
    expect(await json(await get(app, "session", token), 401)).toEqual({ error: "unauthorized" });
  });

  it("refuses a missing, malformed, unknown or expired token, and signs out", async () => {
    const community = await boundCommunity();
    const key = testKey();
    let t = Date.parse("2026-11-17T12:00:00.000Z");
    const { app } = fixture({ admin: () => key.wallet, clock: { now: () => t } });
    const { response } = await signIn(app, community.mint, key);
    const { token } = OperatorSessionCreatedSchema.parse(await json(response, 200));
    expect((await get(app, "session")).status).toBe(401);
    expect((await get(app, "session", "hop_short")).status).toBe(401);
    expect((await get(app, "session", `hop_${"A".repeat(43)}`)).status).toBe(401);
    const cookie = await app.request("/operator/session", {
      headers: { cookie: `__Host-hyphae-operator=${token}` },
    });
    expect(cookie.status).toBe(401);
    const out = await app.request("/operator/session", {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await json(out, 200)).toEqual({ ended: true });
    expect((await get(app, "session", token)).status).toBe(401);
    const again = await signIn(app, community.mint, key);
    const second = OperatorSessionCreatedSchema.parse(await json(again.response, 200));
    t += 4 * 3_600_000;
    expect((await get(app, "session", second.token)).status).toBe(401);
  });

  it("never returns the token, nonce or signature from a read", async () => {
    const community = await boundCommunity();
    const key = testKey();
    const { app } = fixture({ admin: () => key.wallet });
    const { challenge, response } = await signIn(app, community.mint, key);
    const { token } = OperatorSessionCreatedSchema.parse(await json(response, 200));
    const text = JSON.stringify(await json(await get(app, "session", token), 200));
    expect(text).not.toContain(token.slice(4));
    expect(text).not.toContain(challenge.challenge_id);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["expires_at", "mint", "wallet"]);
  });
});
