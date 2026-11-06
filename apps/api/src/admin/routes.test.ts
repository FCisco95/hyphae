import { AdminCommunitySchema } from "@hyphae/core";
import {
  communities,
  type Db,
  epochs,
  payoutPolicies,
  rewardConfigs,
  rewardIntakes,
} from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MemberIdentityProvider } from "../member-auth/privy.js";
import { createTestDb, seedCommunity, seedRewardLane } from "../rewards/test-db.js";
import { adminRoutes } from "./routes.js";

const TOKEN = "fixture.payload.signature";
const SUBJECT = "did:privy:admin";
let database: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  database = await createTestDb();
});
afterAll(async () => {
  await database.close();
});

function fixture(
  options: {
    enabled?: boolean;
    userId?: string | null;
    verify?: MemberIdentityProvider["verify"];
    currentUser?: MemberIdentityProvider["currentUser"];
    telegram?: (chat: bigint, actor: bigint, signal: AbortSignal) => Promise<boolean>;
    timeoutMs?: number;
    db?: Db;
  } = {},
) {
  const calls = { verify: 0, user: 0, telegram: 0 };
  const app = adminRoutes({
    db: options.db ?? database.db,
    enabled: options.enabled ?? true,
    timeoutMs: options.timeoutMs ?? 1000,
    identity: {
      verify: async (token) => {
        calls.verify++;
        expect(token).toBe(TOKEN);
        return options.verify ? options.verify(token) : SUBJECT;
      },
      currentUser: async (subject, signal) => {
        calls.user++;
        return options.currentUser
          ? options.currentUser(subject, signal)
          : {
              id: SUBJECT,
              linked_accounts:
                options.userId === null
                  ? [{ type: "wallet" }]
                  : [{ type: "telegram", telegram_user_id: options.userId ?? "7" }],
            };
      },
    },
    telegramAdmin: async (chat, actor, signal) => {
      calls.telegram++;
      return options.telegram ? options.telegram(chat, actor, signal) : true;
    },
  });
  return { app, calls };
}

const read = (app: ReturnType<typeof adminRoutes>, mint: string, token = TOKEN) =>
  app.request(`/communities/${mint}`, { headers: { authorization: `Bearer ${token}` } });
const write = (app: ReturnType<typeof adminRoutes>, mint: string, update: unknown) =>
  app.request(`/communities/${mint}/intake`, {
    method: "PUT",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(update),
  });
async function privateBody(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Authorization");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  const body = await response.json();
  for (const secret of [TOKEN, SUBJECT, "adminTelegramUserId", "telegramChatId", "provider secret"])
    expect(JSON.stringify(body)).not.toContain(secret);
  return body;
}

describe("private community administration", () => {
  it("is absent by default and when disabled, without calling any identity provider", async () => {
    const { community } = await seedCommunity(database.db);
    const disabled = fixture({ enabled: false });
    await privateBody(await read(disabled.app, community.mint), 404);
    await privateBody(
      await write(disabled.app, community.mint, { paused: true, expected_paused_at: null }),
      404,
    );
    expect(disabled.calls).toEqual({ verify: 0, user: 0, telegram: 0 });
    const app = adminRoutes({ db: database.db });
    await privateBody(await read(app, community.mint), 404);
  });

  it("returns the exact private overview only for the current designated live admin", async () => {
    const { community } = await seedCommunity(database.db);
    const { app, calls } = fixture({
      telegram: async (chat, actor) => {
        expect(chat).toBe(community.telegramChatId);
        expect(actor).toBe(7n);
        return true;
      },
    });
    const body = AdminCommunitySchema.parse(
      await privateBody(await read(app, community.mint), 200),
    );
    expect(body).toMatchObject({
      state: "admin",
      community: { mint: community.mint, name: community.name },
      intake: { paused: false, paused_at: null },
    });
    expect(calls.user).toBeGreaterThanOrEqual(2);
    expect(calls.telegram).toBe(1);
  });

  it("requires a user JWT even with cookies or a forged technical web token", async () => {
    const { community } = await seedCommunity(database.db);
    const { app } = fixture();
    await privateBody(
      await app.request(`/communities/${community.mint}`, {
        headers: {
          cookie: "privy-token=secret",
          "x-hyphae-web-token": "forged",
          "x-hyphae-visitor": "1.2.3.4",
        },
      }),
      401,
    );
    await privateBody(await read(app, community.mint, "malformed"), 401);
    await privateBody(
      await read(
        fixture({
          verify: async () => {
            throw new Error("provider secret");
          },
        }).app,
        community.mint,
      ),
      401,
    );
  });

  it("refuses wallet-only, another designated identity, a revoked live role and another community", async () => {
    const { community } = await seedCommunity(database.db);
    for (const options of [{ userId: null }, { userId: "42" }, { telegram: async () => false }]) {
      const { app } = fixture(options);
      await privateBody(await read(app, community.mint), 403);
      await privateBody(
        await write(app, community.mint, { paused: true, expected_paused_at: null }),
        403,
      );
    }
    const other = await seedCommunity(database.db);
    await database.db
      .update(communities)
      .set({ adminTelegramUserId: 8n })
      .where(eq(communities.id, other.community.id));
    await privateBody(await read(fixture().app, other.community.mint), 403);
    await privateBody(await read(fixture().app, "UnknownMint"), 404);
  });

  it("updates only intake, checks compare-and-swap and preserves a repeated pause timestamp", async () => {
    const { community } = await seedCommunity(database.db);
    const { app } = fixture();
    const first = AdminCommunitySchema.parse(
      await privateBody(
        await write(app, community.mint, { paused: true, expected_paused_at: null }),
        200,
      ),
    );
    expect(first.intake.paused).toBe(true);
    const again = await privateBody(
      await write(app, community.mint, {
        paused: true,
        expected_paused_at: first.intake.paused_at,
      }),
      200,
    );
    expect(again.intake).toEqual(first.intake);
    await privateBody(
      await write(app, community.mint, { paused: false, expected_paused_at: null }),
      409,
    );
    const resumed = await privateBody(
      await write(app, community.mint, {
        paused: false,
        expected_paused_at: first.intake.paused_at,
      }),
      200,
    );
    expect(resumed.intake).toEqual({ paused: false, paused_at: null });
    const [after] = await database.db
      .select()
      .from(communities)
      .where(eq(communities.id, community.id));
    expect(after).toEqual(community);
  });

  it("fails closed on malformed, ambiguous or changed provider identity and provider outages", async () => {
    const { community } = await seedCommunity(database.db);
    const link = { type: "telegram", telegram_user_id: "7" };
    for (const user of [
      { id: "other", linked_accounts: [link] },
      { id: SUBJECT, linked_accounts: [link, link] },
    ]) {
      await privateBody(
        await read(fixture({ currentUser: async () => user }).app, community.mint),
        503,
      );
    }
    let lookups = 0;
    const changed = fixture({
      currentUser: async () => ({
        id: SUBJECT,
        linked_accounts: [{ ...link, telegram_user_id: ++lookups === 1 ? "7" : "8" }],
      }),
    });
    await privateBody(
      await write(changed.app, community.mint, { paused: true, expected_paused_at: null }),
      403,
    );
    await privateBody(
      await read(
        fixture({
          telegram: async () => {
            throw new Error("provider secret");
          },
        }).app,
        community.mint,
      ),
      503,
    );
    expect(
      (await database.db.query.communities.findFirst({ where: eq(communities.id, community.id) }))
        ?.rewardIntakePausedAt,
    ).toBeNull();
  });

  it("rejects query parameters, unknown JSON fields and unsupported methods", async () => {
    const { community } = await seedCommunity(database.db);
    const { app } = fixture();
    await privateBody(await app.request(`/communities/${community.mint}?actor=7`), 400);
    for (const update of [
      { paused: true },
      { paused: true, expected_paused_at: null, communityId: community.id },
      { paused: "yes", expected_paused_at: null },
    ])
      await privateBody(await write(app, community.mint, update), 400);
    for (const [path, method] of [
      [`/communities/${community.mint}`, "POST"],
      [`/communities/${community.mint}/intake`, "GET"],
      [`/communities/${community.mint}`, "OPTIONS"],
    ] as const)
      await privateBody(await app.request(path, { method }), 405);
  });

  it("counts actual streamed bytes even when Content-Length lies, and requires JSON", async () => {
    const { community } = await seedCommunity(database.db);
    for (const length of [undefined, "1", "9999"]) {
      const { app } = fixture();
      const headers: Record<string, string> = {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      };
      if (length) headers["content-length"] = length;
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("x".repeat(1025)));
          controller.close();
        },
      });
      const request = new Request(`http://local/communities/${community.mint}/intake`, {
        method: "PUT",
        headers,
        body,
        duplex: "half",
      } as RequestInit);
      await privateBody(await app.request(request), 400);
    }
    await privateBody(
      await fixture().app.request(`/communities/${community.mint}/intake`, {
        method: "PUT",
        headers: { authorization: `Bearer ${TOKEN}` },
        body: "{}",
      }),
      400,
    );
  });

  it("bounds identity and body reads, and aborts before a delayed provider can write", async () => {
    const { community } = await seedCommunity(database.db);
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { app } = fixture({
      timeoutMs: 40,
      telegram: async () => {
        await waiting;
        return true;
      },
    });
    await privateBody(
      await write(app, community.mint, { paused: true, expected_paused_at: null }),
      503,
    );
    release();
    // Queue a read after the timed-out transaction so its rollback must finish first.
    expect(
      (await database.db.query.communities.findFirst({ where: eq(communities.id, community.id) }))
        ?.rewardIntakePausedAt,
    ).toBeNull();
    await privateBody(
      await read(
        fixture({ timeoutMs: 20, verify: async () => new Promise(() => {}) }).app,
        community.mint,
      ),
      503,
    );
    const stream = new ReadableStream<Uint8Array>({ start() {} });
    const req = new Request(`http://local/communities/${community.mint}/intake`, {
      method: "PUT",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    await privateBody(await fixture({ timeoutMs: 20 }).app.request(req), 503);
  });

  it("rate limits authenticated subjects and does not return provider details", async () => {
    const { community } = await seedCommunity(database.db);
    const { app } = fixture();
    for (let i = 0; i < 5; i++) await privateBody(await read(app, community.mint), 200);
    const response = await read(app, community.mint);
    await privateBody(response, 429);
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  it("does not start provider reads for an already cancelled request", async () => {
    const { community } = await seedCommunity(database.db);
    const { app, calls } = fixture();
    const abort = new AbortController();
    abort.abort();
    const req = new Request(`http://local/communities/${community.mint}`, {
      signal: abort.signal,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    await privateBody(await app.request(req), 503);
    expect(calls).toEqual({ verify: 0, user: 0, telegram: 0 });
  });

  it("reads an overview in a read-only transaction without locking reward writers", async () => {
    const { community } = await seedCommunity(database.db);
    await database.db.transaction(
      async (tx) => {
        await privateBody(await read(fixture({ db: tx }).app, community.mint), 200);
      },
      { accessMode: "read only" },
    );
  });

  it("preserves pinned epochs, configuration, reward history and absent payout policies", async () => {
    const { community } = await seedRewardLane(database.db);
    const snapshot = () =>
      Promise.all([
        database.db.select().from(epochs).where(eq(epochs.communityId, community.id)),
        database.db.select().from(rewardConfigs).where(eq(rewardConfigs.communityId, community.id)),
        database.db.select().from(rewardIntakes).where(eq(rewardIntakes.communityId, community.id)),
        database.db
          .select()
          .from(payoutPolicies)
          .where(eq(payoutPolicies.communityId, community.id)),
      ]);
    const before = await snapshot();
    const { app } = fixture();
    const paused = await privateBody(
      await write(app, community.mint, { paused: true, expected_paused_at: null }),
      200,
    );
    await privateBody(
      await write(app, community.mint, {
        paused: false,
        expected_paused_at: paused.intake.paused_at,
      }),
      200,
    );
    expect(await snapshot()).toEqual(before);
  });

  it("revalidates a JWT that expires or is revoked before the locked mutation", async () => {
    const { community } = await seedCommunity(database.db);
    let verified = 0;
    const { app } = fixture({
      verify: async () => {
        if (++verified > 1) throw new Error("provider secret revoked");
        return SUBJECT;
      },
    });
    await privateBody(
      await write(app, community.mint, { paused: true, expected_paused_at: null }),
      401,
    );
    expect(
      (await database.db.query.communities.findFirst({ where: eq(communities.id, community.id) }))
        ?.rewardIntakePausedAt,
    ).toBeNull();
  });
});
