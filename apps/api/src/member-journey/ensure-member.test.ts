import { members } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { ensureMember } from "./ensure-member.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

describe("ensureMember", () => {
  it("creates a member without a wallet the first time, then returns the same row", async () => {
    const { community } = await seedCommunity(t.db);
    const input = { communityId: community.id, telegramUserId: 501n, telegramUsername: "ana" };
    const first = await ensureMember(t.db, input);
    expect(first).toMatchObject({
      telegramUserId: 501n,
      telegramUsername: "ana",
      wallet: null,
      linkMethod: null,
      linkedAt: null,
    });
    const again = await ensureMember(t.db, input);
    expect(again.id).toBe(first.id);
    const rows = await t.db
      .select()
      .from(members)
      .where(and(eq(members.communityId, community.id), eq(members.telegramUserId, 501n)));
    expect(rows).toHaveLength(1);
  });

  it("returns a linked member unchanged", async () => {
    const { community, member } = await seedCommunity(t.db);
    const found = await ensureMember(t.db, {
      communityId: community.id,
      telegramUserId: member.telegramUserId,
      telegramUsername: null,
    });
    expect(found).toMatchObject({ id: member.id, wallet: member.wallet, linkMethod: "paste" });
  });

  it("settles concurrent first submissions on one row", async () => {
    const { community } = await seedCommunity(t.db);
    const input = { communityId: community.id, telegramUserId: 502n, telegramUsername: null };
    const [a, b] = await Promise.all([ensureMember(t.db, input), ensureMember(t.db, input)]);
    expect(a.id).toBe(b.id);
  });

  it("refuses a half-linked row: wallet, method and link time are set together", async () => {
    const { community } = await seedCommunity(t.db);
    await expect(
      t.db.insert(members).values({
        communityId: community.id,
        telegramUserId: 504n,
        wallet: null,
        linkMethod: "signature",
        linkedAt: null,
      }),
    ).rejects.toThrow();
  });
});
