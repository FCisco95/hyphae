import { contributions, members, raidCards } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { fakeModel } from "../http/demo-seed.js";
import { claimRaidRecap, deliverRaidRecap } from "../raid-alerts/recap.js";
import { runEvaluation } from "../rewards/evaluation.js";
import { createTestDb, later, seedRewardLane, seedTask, T0 } from "../rewards/test-db.js";
import { recordCard } from "./store.js";

const MIN = 60_000;
const WEB = "https://hyphae.test";
// Each test gets its own database: the lane always starts at T0, so raids would share a window.
let t: Awaited<ReturnType<typeof createTestDb>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

// A 48h raid opened at T0 with Alice's reply, scored `quality` unless null, in the lane's open epoch.
async function raidWithReply(quality: number | null) {
  t = await createTestDb();
  const db = t.db;
  const lane = await seedRewardLane(db);
  const raid = await seedTask(db, lane.community.id, T0);
  const intake = await lane.admitOne();
  await db
    .update(contributions)
    .set({ taskId: raid.id, kind: "reply", oembed: { handle: "alice" } })
    .where(eq(contributions.id, intake.contributionId));
  if (quality !== null) {
    const r = await runEvaluation(
      db,
      { communityId: lane.community.id, target: { contributionId: intake.contributionId } },
      { model: "test:fake", call: fakeModel(quality), horizonMs: 5 * MIN, clock: later(2 * MIN) },
    );
    if (r.status !== "completed") throw new Error(`score: ${r.status}`);
  }
  return { db, lane, raid, end: raid.closesAt };
}

// Each test boots its own PGlite inside the test body, which can pass 5 s under full parallel load.
describe("results at a raid's close", { timeout: 30_000 }, () => {
  it("waits while work is being scored, then posts after 15 minutes on its own", async () => {
    const { db, end } = await raidWithReply(null);
    expect(
      await claimRaidRecap(db, WEB, new Date(end.getTime() + 5 * MIN), { results: true }),
    ).toBeUndefined();
    const claim = await claimRaidRecap(db, WEB, new Date(end.getTime() + 16 * MIN), {
      results: true,
    });
    expect(claim).toMatchObject({ html: true, replyTo: null });
    expect(claim?.text).toContain("1 still being scored and may be credited later.");
    expect(claim?.text).not.toContain("@alice");
  });

  it("posts at once when nothing is left to score, names the credited member and replies to the card", async () => {
    const { db, lane, raid, end } = await raidWithReply(85);
    await recordCard(db, {
      taskId: raid.id,
      communityId: lane.community.id,
      telegramChatId: lane.community.telegramChatId,
      telegramMessageId: 70,
      format: "photo",
      state: "ended",
      renderedHash: "h",
      nextRefreshAt: null,
    });
    const claim = await claimRaidRecap(db, WEB, new Date(end.getTime() + MIN), { results: true });
    expect(claim?.replyTo).toBe(70);
    expect(claim?.text).toContain("🥇 @alice:");
    if (!claim) throw new Error("claim");
    const sent: { text: string; options: unknown }[] = [];
    expect(
      await deliverRaidRecap(db, claim, {
        send: async (_chat, text, options) => {
          sent.push({ text, options });
          return { message_id: 71 };
        },
      }),
    ).toBe("sent");
    expect(sent[0]?.options).toEqual({ html: true, replyTo: 70 });
    const [card] = await db.select().from(raidCards).where(eq(raidCards.taskId, raid.id));
    expect(card?.resultsMessageId).toBe(71);
    expect(card?.nextRefreshAt).not.toBeNull();
  });

  it("counts a member without credit but never names them", async () => {
    const { db, lane, raid, end } = await raidWithReply(85);
    const [bob] = await db
      .insert(members)
      .values({
        communityId: lane.community.id,
        telegramUserId: 43n,
        wallet: "WalletBob",
        linkMethod: "paste",
      })
      .returning();
    if (!bob) throw new Error("member");
    const intake = await lane.admitOne(undefined, bob.id, later(3 * MIN));
    await db
      .update(contributions)
      .set({ taskId: raid.id, kind: "quote", oembed: { handle: "bob" } })
      .where(eq(contributions.id, intake.contributionId));
    const r = await runEvaluation(
      db,
      { communityId: lane.community.id, target: { contributionId: intake.contributionId } },
      { model: "test:fake", call: fakeModel(10), horizonMs: 5 * MIN, clock: later(4 * MIN) },
    );
    expect(r.status).toBe("completed");
    const claim = await claimRaidRecap(db, WEB, new Date(end.getTime() + MIN), { results: true });
    expect(claim?.text).toContain("2 took part · 2 contributions · 1 credited · 1 without credit");
    expect(claim?.text).not.toContain("@bob");
  });
});
