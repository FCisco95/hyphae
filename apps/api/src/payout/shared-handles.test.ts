import { epochs, members } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedRewardLane } from "../rewards/test-db.js";
import { clearSharedHandle, sharedHandleReport } from "./shared-handles.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

async function sharedLane() {
  const lane = await seedRewardLane(t.db);
  const communityId = lane.community.id;
  const [epoch] = await t.db.select().from(epochs).where(eq(epochs.communityId, communityId));
  await t.db
    .update(members)
    .set({ xHandles: ["Shared", "solo"] })
    .where(eq(members.id, lane.member.id));
  const [other] = await t.db
    .insert(members)
    .values({ communityId, telegramUserId: 777n, xHandles: ["shared"], linkedAt: null })
    .returning();
  const [alone] = await t.db
    .insert(members)
    .values({ communityId, telegramUserId: 778n, xHandles: ["mine"], linkedAt: null })
    .returning();
  if (!epoch || !other || !alone) throw new Error("seed");
  return { communityId, epoch, a: lane.member.id, b: other.id, alone: alone.id };
}

describe("shared-handle clearances", () => {
  it("reports each shared handle with its members, and clears one member for one epoch", async () => {
    const { communityId, epoch, a, b, alone } = await sharedLane();
    const ref = { communityId, epochId: epoch.id };
    const before = await sharedHandleReport(t.db, ref);
    expect(before.groups).toEqual([{ handle: "shared", memberIds: [a, b].sort() }]);
    expect(before.cleared.size).toBe(0);

    const clear = (memberId: string, note = "asked in Telegram: two people") =>
      clearSharedHandle(t.db, { ...ref, memberId, note });
    expect(await clear(a)).toMatchObject({ status: "cleared" });
    expect(await clear(a)).toEqual({ status: "already_cleared" });
    expect(await clear(alone)).toEqual({ status: "not_shared" });
    await expect(clear(b, "  ")).rejects.toThrow(/note/);
    expect((await sharedHandleReport(t.db, ref)).cleared).toEqual(
      new Map([[a, "asked in Telegram: two people"]]),
    );
  });

  it("refuses a published epoch and a member or epoch of another community", async () => {
    const one = await sharedLane();
    const two = await sharedLane();
    expect(
      await clearSharedHandle(t.db, {
        communityId: one.communityId,
        epochId: two.epoch.id,
        memberId: one.a,
        note: "x",
      }),
    ).toEqual({ status: "not_found" });
    expect(
      await clearSharedHandle(t.db, {
        communityId: one.communityId,
        epochId: one.epoch.id,
        memberId: two.a,
        note: "x",
      }),
    ).toEqual({ status: "not_found" });
    await t.db
      .update(epochs)
      .set({ root: "ab".repeat(32) })
      .where(eq(epochs.id, one.epoch.id));
    expect(
      await clearSharedHandle(t.db, {
        communityId: one.communityId,
        epochId: one.epoch.id,
        memberId: one.a,
        note: "x",
      }),
    ).toEqual({ status: "published" });
  });
});
