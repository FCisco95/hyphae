import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beginDispatch, markReconciliation } from "../rewards/evaluation.js";
import { admitContribution } from "../rewards/intake.js";
import { createTestDb } from "../rewards/test-db.js";
import { type AuditDemo, seedAuditDemo } from "./demo-seed.js";
import { readRoutes } from "./routes.js";

// The arc's stop rule as a test: no Telegram identifier, unverified wallet, private key material
// or model output that never became a decision may leave the read API.

const NOW = new Date("2026-11-20T12:00:00.000Z");
const HIDDEN_OUTPUT = "UNPUBLISHED_OUTPUT_7f3a";
const FORBIDDEN_KEY = /telegram|chat|message_id|idempotency|nonce|session|proof|artifact|digest/i;

let t: Awaited<ReturnType<typeof createTestDb>>;
let demo: AuditDemo;
let unfinished: string;
beforeAll(async () => {
  t = await createTestDb();
  demo = await seedAuditDemo(t.db, NOW);
  // A contribution whose model call returned output that never became a decision.
  const at = async () => new Date(NOW.getTime() - 60_000);
  const admitted = await admitContribution(
    t.db,
    {
      communityId: demo.communityId,
      memberId: demo.members.pasted,
      contribution: {
        kind: "text",
        url: null,
        text: "Unscored work.",
        oembed: null,
        telegramMessageId: 424242,
      },
      artifactKey: "text:sha256:exposure",
      idempotencyKey: "tg:-100555:424242",
      capture: { source: "telegram_text", capturedAt: NOW.toISOString(), limitations: [] },
    },
    { clock: at },
  );
  if (admitted.status !== "admitted") throw new Error(admitted.status);
  unfinished = admitted.intake.contributionId;
  const begun = await beginDispatch(
    t.db,
    { communityId: demo.communityId, target: { contributionId: unfinished }, model: "m" },
    { clock: at },
  );
  if (begun.status !== "begun") throw new Error(begun.status);
  await markReconciliation(
    t.db,
    {
      communityId: demo.communityId,
      dispatchId: begun.dispatch.id,
      error: "provider timeout",
      output: { score: 99, reasoning: HIDDEN_OUTPUT },
    },
    { clock: at },
  );
});
afterAll(async () => {
  await t.close();
});

function keys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) keys(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      keys(v, out);
    }
  }
  return out;
}

describe("read API data exposure", () => {
  it("serves nothing private from any route or any reachable contribution", async () => {
    const app = readRoutes({ db: t.db, clock: async () => NOW });
    const suffix = demo.mint.slice("DemoMint".length);
    const bodies: string[] = [];
    const fetchJson = async (path: string) => {
      const r = await app.request(path);
      expect(r.status, path).toBe(200);
      const text = await r.text();
      bodies.push(text);
      return JSON.parse(text);
    };

    await fetchJson(`/communities/${demo.mint}`);
    const stats = await fetchJson(`/communities/${demo.mint}/stats`);
    // Counts and chain totals only: never a handle, a wallet or a member beside one.
    expect(Object.keys(stats).sort()).toEqual([
      "as_of",
      "community",
      "epochs",
      "members",
      "payouts",
    ]);
    await fetchJson(`/communities/${demo.mint}/leaderboard?epoch=all`);
    const ids = new Set<string>([unfinished]);
    for (const index of [1, 2]) {
      await fetchJson(`/communities/${demo.mint}/epochs/${index}`);
      await fetchJson(`/communities/${demo.mint}/leaderboard?epoch=${index}`);
      const list = await fetchJson(`/communities/${demo.mint}/epochs/${index}/contributions`);
      for (const c of list.contributions) ids.add(c.id);
    }
    expect(ids.size).toBe(8);
    for (const id of ids) await fetchJson(`/contributions/${id}`);
    // The record repeats no contribution link: an X link names the account that posted it.
    const record = await fetchJson(`/wallets/${demo.signedWallet}/record`);
    expect(JSON.stringify(record)).not.toContain("x.com");

    const all = bodies.join("\n");
    for (const secret of [
      "987654321987",
      "987654321988",
      "tg_secret_user",
      "tg_other_user",
      demo.pastedWallet,
      HIDDEN_OUTPUT,
      "provider timeout",
      `demo:${suffix}`,
      `demo-${suffix}`,
      "tg:-100555",
      "0".repeat(64),
    ]) {
      expect(all, secret).not.toContain(secret);
    }
    const allKeys = bodies.flatMap((b) => keys(JSON.parse(b)));
    expect(allKeys.filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
    expect(allKeys.filter((k) => k === "input" || k === "output")).toEqual([]);
    // The signed wallet is the one address that may appear, and only where a wallet belongs: the
    // community's totals name no member, handle or wallet at all.
    expect(all).toContain(demo.signedWallet);
    const statsText = JSON.stringify(stats);
    for (const wallet of [demo.signedWallet, demo.pastedWallet]) {
      expect(statsText, wallet).not.toContain(wallet);
    }
    for (const member of Object.values(demo.members)) expect(statsText).not.toContain(member);
    expect(statsText).not.toMatch(/handle|x\.com|twitter|wallet"/i);
  });
});

describe("operator API data exposure", () => {
  it("names no handle, Telegram id or member, and puts nothing beside a payable wallet", async () => {
    const { adminRoutes } = await import("../admin/routes.js");
    const { operatorAuthStore } = await import("../admin-auth/store.js");
    const { seedReadyEpoch, randomAddress } = await import("../payout/ready-seed.js");
    const { FAKE_ADMIN, fakeSettleChain } = await import("../payout/settle-fake.js");
    const { communities, members } = await import("@hyphae/db");
    const { eq } = await import("drizzle-orm");
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress });
    const people = await t.db
      .select({ id: members.id, telegram: members.telegramUserId })
      .from(members)
      .where(eq(members.communityId, seed.communityId));
    for (const [i, p] of people.entries())
      await t.db
        .update(members)
        .set({ xHandles: [`exposure_handle_${i}`] })
        .where(eq(members.id, p.id));
    // Long, unique ids so a match means a leak, not a coincidence.
    const [community] = await t.db
      .update(communities)
      .set({ adminTelegramUserId: 987654321999n })
      .where(eq(communities.id, seed.communityId))
      .returning();
    if (!community) throw new Error("seed");
    const store = operatorAuthStore();
    const app = adminRoutes({
      db: t.db,
      enabled: true,
      operator: {
        store,
        origins: ["https://hyphae.test"],
        network: "solana:devnet",
        onChainAdmin: async () => FAKE_ADMIN,
        settle: async () => fakeSettleChain({ community: chainAddress, free: 1n }).chain,
        gate: { clock: () => NOW },
        now: () => NOW,
      },
    });
    const { token } = store.open({ mint: seed.mint, wallet: FAKE_ADMIN });
    const bodies: string[] = [];
    for (const path of [
      "status",
      "session",
      `communities/${seed.mint}/overview`,
      `communities/${seed.mint}/epochs/1/payable`,
      `communities/${seed.mint}/epochs/2/payable`,
    ]) {
      const r = await app.request(`/operator/${path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(r.status, path).toBe(200);
      bodies.push(await r.text());
    }
    const all = bodies.join("\n");
    for (const secret of [
      ...people.map((p) => p.id),
      ...people.map((p) => String(p.telegram)),
      String(community.adminTelegramUserId),
      String(community.telegramChatId),
      "exposure_handle_",
      token.slice(4),
      seed.wallets.unsigned,
    ])
      expect(all, secret).not.toContain(secret);
    const allKeys = bodies.flatMap((b) => keys(JSON.parse(b)));
    expect(allKeys.filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
    expect(allKeys.filter((k) => /handle|member|point|x_/i.test(k))).toEqual([]);
    // The payable list is wallets and nothing else.
    expect(Object.keys(JSON.parse(bodies[3] as string)).sort()).toEqual([
      "epoch_index",
      "gate_status",
      "wallets",
    ]);
  });

  it("names no handle, Telegram id or member in the publish build, status and submit", async () => {
    const { adminRoutes } = await import("../admin/routes.js");
    const { operatorAuthStore } = await import("../admin-auth/store.js");
    const { buildStore } = await import("../admin-auth/builds.js");
    const { testKey } = await import("../admin-auth/test-key.js");
    const { seedReadyEpoch, randomAddress } = await import("../payout/ready-seed.js");
    const { fakeSettleChain } = await import("../payout/settle-fake.js");
    const { fakeRpc } = await import("../payout/rpc-fake.js");
    const { solanaChain } = await import("../payout/chain.js");
    const { communities, members, payoutPolicies } = await import("@hyphae/db");
    const { eq } = await import("drizzle-orm");
    const { getBase64Encoder, getBase58Decoder } = await import("@solana/kit");
    const key = testKey();
    const chainAddress = randomAddress();
    const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress });
    await t.db.insert(payoutPolicies).values({
      communityId: seed.communityId,
      effectiveFromIndex: 1,
      thresholdVolumeLamports: 100_000_000_000n,
      basis: "cumulative",
      rewardBpsOfVolume: 100,
      autoPublish: false,
    });
    const people = await t.db
      .select({ id: members.id, telegram: members.telegramUserId })
      .from(members)
      .where(eq(members.communityId, seed.communityId));
    for (const [i, p] of people.entries())
      await t.db
        .update(members)
        .set({ xHandles: [`publish_handle_${i}`] })
        .where(eq(members.id, p.id));
    const [community] = await t.db
      .update(communities)
      .set({ adminTelegramUserId: 987654321888n })
      .where(eq(communities.id, seed.communityId))
      .returning();
    if (!community) throw new Error("seed");
    const fake = fakeSettleChain({
      community: chainAddress,
      free: 2_000_000_000n,
      admin: key.wallet,
    });
    const rpc = fakeRpc();
    const sending = (signer: Parameters<typeof solanaChain>[0]["admin"]) =>
      solanaChain({
        rpcUrl: "https://rpc.test",
        wsUrl: "wss://rpc.test",
        network: "solana:devnet",
        admin: signer,
        rpc: rpc.rpc,
        rpcSubscriptions: rpc.rpcSubscriptions,
      });
    const store = operatorAuthStore();
    const app = adminRoutes({
      db: t.db,
      enabled: true,
      operator: {
        store,
        origins: ["https://hyphae.test"],
        network: "solana:devnet",
        onChainAdmin: async () => key.wallet,
        gate: { clock: () => NOW },
        now: () => NOW,
        publishEnabled: true,
        publish: {
          network: "solana:devnet",
          chain: async (publisher) => ({
            ...fake.chain,
            publisher: publisher
              ? {
                  address: publisher.address,
                  publishEpoch: async (input) =>
                    (await sending(publisher)).chain.publishEpoch(input),
                }
              : null,
          }),
          sending,
          send: async (tx) =>
            getBase58Decoder().decode(Object.values(tx.signatures)[0] as Uint8Array),
          blockHeight: async () => 10n,
          builds: buildStore(),
          setupRecords: [],
          gate: { clock: () => NOW },
        },
      },
    });
    const { token } = store.open({ mint: seed.mint, wallet: key.wallet });
    const request = (method: string, path: string, body?: unknown) =>
      app.request(`/operator/communities/${seed.mint}/${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const bodies: string[] = [];
    const build = await request("POST", "publish/build", {});
    expect(build.status).toBe(200);
    const built = (await build.json()) as { build: { id: string }; message: string };
    bodies.push(JSON.stringify(built));
    bodies.push(await (await request("GET", "publish/status")).text());
    const submit = await request("POST", "publish/submit", {
      build_id: built.build.id,
      signature: key.signRaw(new Uint8Array(getBase64Encoder().encode(built.message))),
    });
    expect(submit.status).toBe(200);
    bodies.push(await submit.text());
    const all = bodies.join("\n");
    for (const secret of [
      ...people.map((p) => p.id),
      ...people.map((p) => String(p.telegram)),
      String(community.adminTelegramUserId),
      String(community.telegramChatId),
      "publish_handle_",
      token.slice(4),
      seed.wallets.unsigned,
    ])
      expect(all, secret).not.toContain(secret);
    const allKeys = bodies.flatMap((b) => keys(JSON.parse(b)));
    expect(allKeys.filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
    expect(allKeys.filter((k) => /handle|member|point|x_/i.test(k))).toEqual([]);
    // The build names no payable wallet: only how many there are.
    for (const wallet of Object.values(seed.wallets))
      expect(bodies[0], wallet).not.toContain(wallet);
  });
});
