import {
  OperatorChallengeSchema,
  OperatorPublishBuildSchema,
  OperatorPublishStatusSchema,
  OperatorPublishSubmitSchema,
  OperatorSessionCreatedSchema,
} from "@hyphae/core";
import { communities, payoutPolicies } from "@hyphae/db";
import { getBase64Encoder, type TransactionSigner } from "@solana/kit";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminRoutes } from "../admin/routes.js";
import { solanaChain } from "../payout/chain.js";
import type { SettleChain } from "../payout/distribution-settle.js";
import { randomAddress, seedReadyEpoch } from "../payout/ready-seed.js";
import { fakeRpc } from "../payout/rpc-fake.js";
import { fakeSettleChain } from "../payout/settle-fake.js";
import { createTestDb } from "../rewards/test-db.js";
import { buildStore } from "./builds.js";
import type { PublishDeps } from "./publish.js";
import type { SetupRecord } from "./setup-records.js";
import { operatorAuthStore } from "./store.js";
import { testKey } from "./test-key.js";

const ORIGIN = "https://hyphae.test";
const NOW = new Date("2026-11-20T12:00:00.000Z");
const SOL = 1_000_000_000n;
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

async function world(
  o: { publishEnabled?: boolean; publish?: false; records?: SetupRecord[]; bound?: boolean } = {},
) {
  const key = testKey();
  const chainAddress = randomAddress();
  const seed = await seedReadyEpoch(t.db, {
    now: NOW,
    chainAddress: o.bound === false ? null : chainAddress,
  });
  await t.db.insert(payoutPolicies).values({
    communityId: seed.communityId,
    effectiveFromIndex: 1,
    thresholdVolumeLamports: 100n * SOL,
    basis: "cumulative",
    rewardBpsOfVolume: 100,
    autoPublish: false,
  });
  const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL, admin: key.wallet });
  const rpc = fakeRpc();
  const sending = (signer: TransactionSigner) =>
    solanaChain({
      rpcUrl: "https://rpc.test",
      wsUrl: "wss://rpc.test",
      network: "solana:devnet",
      admin: signer,
      rpc: rpc.rpc,
      rpcSubscriptions: rpc.rpcSubscriptions,
    });
  const sent: string[] = [];
  const publish: PublishDeps = {
    network: "solana:devnet",
    chain: async (publisher?: TransactionSigner): Promise<SettleChain> => ({
      ...fake.chain,
      publisher: publisher
        ? {
            address: publisher.address,
            publishEpoch: async (input) => (await sending(publisher)).chain.publishEpoch(input),
          }
        : null,
    }),
    sending,
    send: async (transaction) => {
      const { getBase58Decoder } = await import("@solana/kit");
      const text = getBase58Decoder().decode(
        Object.values(transaction.signatures)[0] as Uint8Array,
      );
      sent.push(text);
      return text;
    },
    blockHeight: async () => 10n,
    startHeight: async () => 0n,
    builds: buildStore(),
    setupRecords: (o.records ?? []).map((r) => ({ ...r, mint: r.mint || seed.mint })),
    gate: { clock: () => NOW },
  };
  const store = operatorAuthStore();
  const app = adminRoutes({
    db: t.db,
    enabled: true,
    operator: {
      store,
      origins: [ORIGIN],
      network: "solana:devnet",
      onChainAdmin: async ({ address }) => (address === chainAddress ? fake.state.admin : null),
      publishEnabled: o.publishEnabled ?? true,
      ...(o.publish === false ? {} : { publish }),
      gate: { clock: () => NOW },
      now: () => NOW,
    },
  });
  return { key, seed, fake, app, store, sent, chainAddress };
}

const call = (
  app: ReturnType<typeof adminRoutes>,
  method: "GET" | "POST",
  path: string,
  token?: string,
  body?: unknown,
) =>
  app.request(`/operator/${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      "fly-client-ip": "9.9.9.9",
    },
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
  });

async function json(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response.json();
}

async function signIn(w: Awaited<ReturnType<typeof world>>, key = w.key) {
  const challenge = OperatorChallengeSchema.parse(
    await json(
      await call(w.app, "POST", "challenge", undefined, { mint: w.seed.mint, wallet: key.wallet }),
      200,
    ),
  );
  const response = await call(w.app, "POST", "session", undefined, {
    challenge_id: challenge.challenge_id,
    signature: key.signRaw(challenge.message),
  });
  return response;
}

const NEW_ROUTES = [
  ["GET", "publish/status"],
  ["POST", "publish/build"],
  ["POST", "publish/submit"],
  ["POST", "init/build"],
  ["POST", "init/submit"],
] as const;

describe("OPERATOR_PUBLISH_ENABLED", () => {
  it("off: every publish and init route answers 404 disabled, even with a session", async () => {
    const w = await world({ publishEnabled: false });
    const { token } = w.store.open({ mint: w.seed.mint, wallet: w.key.wallet });
    for (const [method, path] of NEW_ROUTES) {
      expect(
        await json(await call(w.app, method, `communities/${w.seed.mint}/${path}`, token), 404),
        path,
      ).toEqual({ error: "disabled" });
    }
    // Part A is unchanged.
    expect((await call(w.app, "GET", `communities/${w.seed.mint}/overview`, token)).status).toBe(
      200,
    );
    expect(w.sent).toEqual([]);
  });

  it("on without a chain to build with: 503, nothing read", async () => {
    const w = await world({ publish: false });
    const { token } = w.store.open({ mint: w.seed.mint, wallet: w.key.wallet });
    expect(
      await json(await call(w.app, "POST", `communities/${w.seed.mint}/publish/build`, token), 503),
    ).toEqual({ error: "unavailable" });
  });
});

describe("publish over HTTP", () => {
  it("builds, takes the wallet's signature and publishes once", async () => {
    const w = await world();
    const created = OperatorSessionCreatedSchema.parse(await json(await signIn(w), 200));
    expect(created.role).toBeUndefined();
    const built = OperatorPublishBuildSchema.parse(
      await json(
        await call(w.app, "POST", `communities/${w.seed.mint}/publish/build`, created.token),
        200,
      ),
    );
    if (built.status !== "awaiting_signature") throw new Error(built.status);
    const status = OperatorPublishStatusSchema.parse(
      await json(
        await call(w.app, "GET", `communities/${w.seed.mint}/publish/status`, created.token),
        200,
      ),
    );
    expect(status.build).toMatchObject({ id: built.build.id, state: "awaiting_signature" });
    const signature = w.key.signRaw(new Uint8Array(getBase64Encoder().encode(built.message)));
    const out = OperatorPublishSubmitSchema.parse(
      await json(
        await call(w.app, "POST", `communities/${w.seed.mint}/publish/submit`, created.token, {
          build_id: built.build.id,
          signature,
        }),
        200,
      ),
    );
    expect(out).toEqual({ status: "published", signature, epoch_index: 1, recovered: false });
    expect(w.sent).toEqual([signature]);
  });

  it("refuses another community's mint, and a body with anything in it", async () => {
    const w = await world();
    const { token } = w.store.open({ mint: w.seed.mint, wallet: w.key.wallet });
    for (const [method, path] of NEW_ROUTES) {
      expect(
        await json(await call(w.app, method, `communities/${randomAddress()}/${path}`, token), 403),
        path,
      ).toEqual({ error: "forbidden" });
    }
    expect(
      await json(
        await call(w.app, "POST", `communities/${w.seed.mint}/publish/build`, token, { epoch: 1 }),
        400,
      ),
    ).toEqual({ error: "invalid_request" });
  });

  it("refuses init to an admin session and publish to a wallet no longer the admin", async () => {
    const w = await world();
    const { token } = w.store.open({ mint: w.seed.mint, wallet: w.key.wallet });
    expect(
      await json(
        await call(w.app, "POST", `communities/${w.seed.mint}/init/build`, token, {
          fee_recipient: randomAddress(),
        }),
        403,
      ),
    ).toEqual({ error: "forbidden" });
    w.fake.state.admin = randomAddress();
    expect(
      await json(await call(w.app, "POST", `communities/${w.seed.mint}/publish/build`, token), 403),
    ).toEqual({ error: "forbidden" });
    expect(w.sent).toEqual([]);
  });

  it("bounds builds per session", async () => {
    const w = await world();
    const { token } = w.store.open({ mint: w.seed.mint, wallet: w.key.wallet });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++)
      statuses.push(
        (await call(w.app, "POST", `communities/${w.seed.mint}/publish/build`, token)).status,
      );
    expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true);
    expect(statuses[6]).toBe(429);
  });
});

describe("setup sign-in for init-community", () => {
  it("signs in the recorded admin of an unbound community as a setup session, with no reads", async () => {
    const key = testKey();
    const w = await world({
      bound: false,
      records: [
        { mint: "", network: "solana:devnet", admin: key.wallet, feeRecipient: randomAddress() },
      ],
    });
    const created = OperatorSessionCreatedSchema.parse(await json(await signIn(w, key), 200));
    expect(created.role).toBe("setup");
    for (const path of ["overview", "epochs/1/payable"])
      expect(
        await json(
          await call(w.app, "GET", `communities/${w.seed.mint}/${path}`, created.token),
          403,
        ),
      ).toEqual({ error: "forbidden" });
    expect(
      await json(
        await call(w.app, "POST", `communities/${w.seed.mint}/publish/build`, created.token),
        403,
      ),
    ).toEqual({ error: "forbidden" });
    // Bound meanwhile: the setup session ends.
    await t.db
      .update(communities)
      .set({ chainAddress: w.chainAddress })
      .where(eq(communities.id, w.seed.communityId));
    expect(
      await json(
        await call(w.app, "GET", `communities/${w.seed.mint}/publish/status`, created.token),
        403,
      ),
    ).toEqual({ error: "forbidden" });
    expect(await json(await call(w.app, "GET", "session", created.token), 401)).toEqual({
      error: "unauthorized",
    });
  });

  it("refuses a wallet the record does not name, no record, and the flag off", async () => {
    const recorded = testKey();
    const record = {
      mint: "",
      network: "solana:devnet" as const,
      admin: recorded.wallet,
      feeRecipient: randomAddress(),
    };
    const named = await world({ bound: false, records: [record] });
    expect(await json(await signIn(named, testKey()), 403)).toEqual({ error: "forbidden" });
    for (const w of [
      await world({ bound: false }),
      await world({ bound: false, records: [record], publishEnabled: false }),
    ]) {
      expect(
        await json(
          await call(w.app, "POST", "challenge", undefined, {
            mint: w.seed.mint,
            wallet: recorded.wallet,
          }),
          403,
        ),
      ).toEqual({ error: "forbidden" });
    }
  });
});
