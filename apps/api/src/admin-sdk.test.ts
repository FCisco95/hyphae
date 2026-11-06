import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHyphaeAdminClient } from "../../../packages/admin-client/src/index.js";
import { adminRoutes } from "./admin/routes.js";
import { createTestDb, seedCommunity } from "./rewards/test-db.js";

let database: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  database = await createTestDb();
});
afterAll(async () => {
  await database.close();
});

function client({ enabled = true, actor = "7", liveAdmin = true } = {}) {
  const app = new Hono().route(
    "/admin/v1",
    adminRoutes({
      db: database.db,
      enabled,
      identity: {
        verify: async (token) => {
          if (token !== "fixture.payload.signature") throw new Error("invalid token");
          return "did:privy:fixture";
        },
        currentUser: async () => ({
          id: "did:privy:fixture",
          linked_accounts: [{ type: "telegram", telegram_user_id: actor }],
        }),
      },
      telegramAdmin: async () => liveAdmin,
    }),
  );
  return createHyphaeAdminClient({
    baseUrl: "https://fixture.example/admin/v1",
    getAccessToken: () => "fixture.payload.signature",
    fetch: async (input, init) => {
      expect(init).toMatchObject({ credentials: "omit", redirect: "error", cache: "no-store" });
      return app.fetch(new Request(input, init));
    },
  });
}

describe("admin SDK against the real API with a disposable database", () => {
  it("reads, pauses, reads back and resumes only the selected community", async () => {
    const first = await seedCommunity(database.db);
    const second = await seedCommunity(database.db);
    const sdk = client();
    const initial = await sdk.getCommunity(first.community.mint);
    expect(initial.intake).toEqual({ paused: false, paused_at: null });
    const paused = await sdk.setIntakePaused(first.community.mint, {
      paused: true,
      expected_paused_at: null,
    });
    expect(paused.intake.paused).toBe(true);
    expect((await sdk.getCommunity(first.community.mint)).intake).toEqual(paused.intake);
    const resumed = await sdk.setIntakePaused(first.community.mint, {
      paused: false,
      expected_paused_at: paused.intake.paused_at,
    });
    expect(resumed.intake).toEqual(initial.intake);
    const [untouched] = await database.db
      .select()
      .from(communities)
      .where(eq(communities.id, second.community.id));
    expect(untouched?.rewardIntakePausedAt).toBeNull();
  });

  it("surfaces a stale edit as conflict without replacing the current pause", async () => {
    const { community } = await seedCommunity(database.db);
    const sdk = client();
    const paused = await sdk.setIntakePaused(community.mint, {
      paused: true,
      expected_paused_at: null,
    });
    await expect(
      sdk.setIntakePaused(community.mint, { paused: false, expected_paused_at: null }),
    ).rejects.toMatchObject({ code: "conflict", status: 409 });
    expect((await sdk.getCommunity(community.mint)).intake).toEqual(paused.intake);
  });

  it("preserves the timestamp for an explicitly confirmed repeated pause", async () => {
    const { community } = await seedCommunity(database.db);
    const sdk = client();
    const paused = await sdk.setIntakePaused(community.mint, {
      paused: true,
      expected_paused_at: null,
    });
    const repeated = await sdk.setIntakePaused(community.mint, {
      paused: true,
      expected_paused_at: paused.intake.paused_at,
    });
    expect(repeated.intake).toEqual(paused.intake);
  });

  it("keeps disabled, non-designated and demoted callers outside the write boundary", async () => {
    const { community } = await seedCommunity(database.db);
    for (const [sdk, code, status] of [
      [client({ enabled: false }), "not_found", 404],
      [client({ actor: "42" }), "forbidden", 403],
      [client({ liveAdmin: false }), "forbidden", 403],
    ] as const) {
      await expect(
        sdk.setIntakePaused(community.mint, { paused: true, expected_paused_at: null }),
      ).rejects.toMatchObject({ code, status });
    }
    const [stored] = await database.db
      .select()
      .from(communities)
      .where(eq(communities.id, community.id));
    expect(stored?.rewardIntakePausedAt).toBeNull();
  });
});
