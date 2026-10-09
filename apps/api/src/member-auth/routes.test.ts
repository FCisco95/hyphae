import { MemberAccountSchema } from "@hyphae/core";
import { communities, members, memberWalletLinks } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, rubric } from "../rewards/test-db.js";
import type { MemberIdentityProvider } from "./privy.js";
import { memberRoutes } from "./routes.js";

const TOKEN = "fixture.payload.signature";
const DID = "did:privy:fixture";
const WALLET = "So11111111111111111111111111111111111111112";
const WALLET_B = "11111111111111111111111111111111";
let testDb: Awaited<ReturnType<typeof createTestDb>>;
let communityId: string;
beforeAll(async () => {
  testDb = await createTestDb();
  for (const [mint, chat, wallet] of [
    ["MintA", -1001n, WALLET],
    ["MintB", -1002n, WALLET_B],
  ] as const) {
    const [community] = await testDb.db
      .insert(communities)
      .values({
        mint,
        name: mint,
        telegramChatId: chat,
        adminTelegramUserId: 7n,
        rubricVersion: rubric.version,
        rubric,
      })
      .returning();
    if (!community) throw new Error("fixture community absent");
    if (mint === "MintA") communityId = community.id;
    await testDb.db.insert(members).values({
      communityId: community.id,
      telegramUserId: 123n,
      wallet,
      linkMethod: "signature",
      linkedAt: new Date("2026-10-01T00:00:00Z"),
    });
  }
});
afterAll(async () => testDb.close());

function fixture(
  options: {
    user?: unknown;
    group?: { status: string; is_member?: boolean };
    identity?: MemberIdentityProvider;
    failGroup?: boolean;
  } = {},
) {
  const identity: MemberIdentityProvider = options.identity ?? {
    verify: async () => DID,
    currentUser: async () =>
      options.user ?? {
        id: DID,
        linked_accounts: [
          { type: "telegram", telegram_user_id: "123" },
          { type: "wallet", address: WALLET_B },
        ],
      },
  };
  return memberRoutes({
    db: testDb.db,
    identity,
    chatMember: async () => {
      if (options.failGroup) throw new Error("private Telegram details");
      return options.group ?? { status: "member" };
    },
    now: () => new Date("2026-10-09T12:00:00.000Z"),
  });
}
const read = (
  app: ReturnType<typeof memberRoutes>,
  suffix = "",
  mint = "MintA",
  token: string | null = TOKEN,
) =>
  app.request(`/communities/${mint}/me${suffix}`, {
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  });
async function expectPrivate(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Authorization");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  const body = await response.json();
  const text = JSON.stringify(body);
  for (const secret of [
    TOKEN,
    DID,
    "telegram_user_id",
    "member_id",
    "fixture@example.test",
    "private Telegram details",
  ])
    expect(text).not.toContain(secret);
  return body;
}

describe("private member reads", () => {
  it("stays unavailable with missing configuration", async () => {
    await expectPrivate(await read(memberRoutes({ db: testDb.db })), 503);
  });
  it.each([null, "", "not-a-token"])(
    "rejects missing or malformed credential %s",
    async (token) => {
      await expectPrivate(await read(fixture(), "", "MintA", token), 401);
    },
  );
  it("rejects an oversized credential", async () => {
    await expectPrivate(await read(fixture(), "", "MintA", "x".repeat(4097)), 401);
  });
  it("rejects invalid tokens without returning verifier details", async () => {
    const app = fixture({
      identity: {
        verify: async () => {
          throw new Error(TOKEN);
        },
        currentUser: async () => ({}),
      },
    });
    await expectPrivate(await read(app), 401);
  });
  it.each(["telegram_user_id=999", "member=other", "subject=other", "wallet=other", "chat=other"])(
    "refuses caller selector %s",
    async (selector) => {
      await expectPrivate(await read(fixture(), `?${selector}`), 400);
    },
  );
  it("does not accept arbitrary identity headers", async () => {
    const response = await fixture().request("/communities/MintA/me", {
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "x-telegram-user-id": "999",
        "x-member-id": "other",
      },
    });
    const body = await expectPrivate(response, 200);
    expect(body.wallet.address).toBe(WALLET);
  });
  it("returns unknown communities privately", async () => {
    await expectPrivate(await read(fixture(), "", "Unknown"), 404);
  });
  it("requires explicit Telegram linking", async () => {
    const body = await expectPrivate(
      await read(
        fixture({
          user: { id: DID, linked_accounts: [{ type: "email", address: "fixture@example.test" }] },
        }),
      ),
      200,
    );
    expect(body.state).toBe("telegram_required");
    expect(body.wallet).toBeUndefined();
  });
  it.each([
    { id: "did:privy:other", linked_accounts: [] },
    { id: DID, linked_accounts: [{ type: "telegram", telegram_user_id: "01" }] },
  ])("fails closed on wrong or malformed provider identity", async (user) => {
    await expectPrivate(await read(fixture({ user })), 503);
  });
  it.each(["left", "kicked"])("denies private wallet to %s group member", async (status) => {
    const body = await expectPrivate(await read(fixture({ group: { status } })), 200);
    expect(body.state).toBe("join_required");
    expect(body.wallet).toBeUndefined();
  });
  it("denies restricted non-members but permits restricted actual members", async () => {
    expect(
      (
        await expectPrivate(
          await read(fixture({ group: { status: "restricted", is_member: false } })),
          200,
        )
      ).state,
    ).toBe("join_required");
    expect(
      (
        await expectPrivate(
          await read(fixture({ group: { status: "restricted", is_member: true } })),
          200,
        )
      ).state,
    ).toBe("member");
  });
  it("fails closed when Telegram is unavailable", async () => {
    await expectPrivate(await read(fixture({ failGroup: true })), 503);
  });
  it.each([{ status: "unknown" }, { status: "restricted" }])(
    "does not interpret an unknown Telegram result as a known absence",
    async (group) => {
      await expectPrivate(await read(fixture({ group })), 503);
    },
  );
  it("does not create a member for a linked group member", async () => {
    const before = await testDb.db.select().from(members);
    const body = await expectPrivate(
      await read(
        fixture({
          user: { id: DID, linked_accounts: [{ type: "telegram", telegram_user_id: "999" }] },
        }),
      ),
      200,
    );
    expect(body.state).toBe("member_not_registered");
    expect(await testDb.db.select().from(members)).toEqual(before);
  });
  it("reads the recorded reward wallet rather than the login wallet", async () => {
    const beforeMembers = await testDb.db.select().from(members);
    const beforeLinks = await testDb.db.select().from(memberWalletLinks);
    const body = await expectPrivate(await read(fixture()), 200);
    expect(MemberAccountSchema.parse(body)).toEqual({
      community: { mint: "MintA", name: "MintA" },
      as_of: "2026-10-09T12:00:00.000Z",
      state: "member",
      wallet: { address: WALLET, status: "signature" },
    });
    expect(await testDb.db.select().from(members)).toEqual(beforeMembers);
    expect(await testDb.db.select().from(memberWalletLinks)).toEqual(beforeLinks);
  });
  it("scopes the same Telegram identity to the selected community", async () => {
    const app = fixture();
    expect((await expectPrivate(await read(app), 200)).wallet.address).toBe(WALLET);
    expect((await expectPrivate(await read(app, "", "MintB"), 200)).wallet.address).toBe(WALLET_B);
  });
  it("returns explicit none for an existing member with no wallet", async () => {
    await testDb.db.insert(members).values({
      communityId,
      telegramUserId: 456n,
      wallet: null,
      linkMethod: null,
      linkedAt: null,
    });
    const body = await expectPrivate(
      await read(
        fixture({
          user: { id: DID, linked_accounts: [{ type: "telegram", telegram_user_id: "456" }] },
        }),
      ),
      200,
    );
    expect(body.wallet).toEqual({ address: null, status: "none" });
  });
  it("reads current links on every request", async () => {
    let linked = true;
    const app = fixture({
      identity: {
        verify: async () => DID,
        currentUser: async () => ({
          id: DID,
          linked_accounts: linked ? [{ type: "telegram", telegram_user_id: "123" }] : [],
        }),
      },
    });
    expect((await expectPrivate(await read(app), 200)).state).toBe("member");
    linked = false;
    expect((await expectPrivate(await read(app), 200)).state).toBe("telegram_required");
  });
  it("checks current group membership on every request", async () => {
    let status = "member";
    const app = memberRoutes({
      db: testDb.db,
      identity: {
        verify: async () => DID,
        currentUser: async () => ({
          id: DID,
          linked_accounts: [{ type: "telegram", telegram_user_id: "123" }],
        }),
      },
      chatMember: async () => ({ status }),
    });
    expect((await expectPrivate(await read(app), 200)).state).toBe("member");
    status = "kicked";
    expect((await expectPrivate(await read(app), 200)).state).toBe("join_required");
  });
  it("limits a verified subject before further external reads", async () => {
    const app = fixture();
    for (let i = 0; i < 5; i++) await expectPrivate(await read(app), 200);
    await expectPrivate(await read(app), 429);
  });
  it("limits unauthenticated requests before verification", async () => {
    const app = fixture();
    for (let i = 0; i < 30; i++) await expectPrivate(await read(app, "", "MintA", null), 401);
    await expectPrivate(await read(app, "", "MintA", null), 429);
  });
  it("bounds a hung provider read and aborts the operation", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      let reached!: () => void;
      const started = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const app = fixture({
        identity: {
          verify: async () => DID,
          currentUser: async (_subject, inputSignal) => {
            signal = inputSignal;
            reached();
            return new Promise(() => {});
          },
        },
      });
      const response = read(app);
      await started;
      await vi.advanceTimersByTimeAsync(5000);
      await expectPrivate(await response, 503);
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("bounds a hung Telegram read and aborts it", async () => {
    vi.useFakeTimers();
    try {
      let reached!: () => void;
      const started = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const app = memberRoutes({
        db: testDb.db,
        identity: {
          verify: async () => DID,
          currentUser: async () => ({
            id: DID,
            linked_accounts: [{ type: "telegram", telegram_user_id: "123" }],
          }),
        },
        chatMember: async () => {
          reached();
          return new Promise(() => {});
        },
      });
      const response = read(app);
      await started;
      await vi.advanceTimersByTimeAsync(5000);
      await expectPrivate(await response, 503);
    } finally {
      vi.useRealTimers();
    }
  });
  it("makes unmatched routes and methods private too", async () => {
    await expectPrivate(await fixture().request("/missing"), 404);
    await expectPrivate(await fixture().request("/communities/MintA/me", { method: "POST" }), 404);
  });
  it("does not expose an inconsistent database wallet", async () => {
    const ownMember = and(eq(members.communityId, communityId), eq(members.telegramUserId, 123n));
    await testDb.db.update(members).set({ wallet: "invalid-wallet" }).where(ownMember);
    await expectPrivate(await read(fixture()), 503);
    await testDb.db.update(members).set({ wallet: WALLET }).where(ownMember);
  });
});
