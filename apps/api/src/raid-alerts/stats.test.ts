import { contributions } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedAuditDemo } from "../http/demo-seed.js";
import { readContribution } from "../http/read-service.js";
import { createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import { raidStats, span, statsLine } from "./stats.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

describe("raid stats text", () => {
  const base = { members: 0, scoring: 0, epochs: [] };
  it("prints counts only, with the average once something is credited", () => {
    expect(statsLine({ ...base, replies: 4, quotes: 2, credited: 3, averageCredited: 71 })).toBe(
      "Replies 4 · Quotes 2 · Credited 3 · Avg credited score 71",
    );
    expect(statsLine({ ...base, replies: 1, quotes: 0, credited: 0, averageCredited: null })).toBe(
      "Replies 1 · Quotes 0 · Credited 0",
    );
  });
  it("formats spans in hours and minutes", () => {
    expect(span(5 * 3_600_000 + 12 * 60_000 + 59_000)).toBe("5h 12m");
    expect(span(12 * 3_600_000)).toBe("12h");
    expect(span(42 * 60_000)).toBe("42m");
    expect(span(59_000)).toBe("under a minute");
    expect(span(-1)).toBe("under a minute");
  });
});

describe("raid stats query", () => {
  it("counts credited work exactly as the public contribution read selects it", async () => {
    const now = new Date();
    const demo = await seedAuditDemo(t.db, now);
    const raid = await seedTask(t.db, demo.communityId, new Date(now.getTime() - 9 * 86_400_000));
    const ids = Object.values(demo.contributions);
    for (const [i, id] of ids.entries())
      await t.db
        .update(contributions)
        .set({ taskId: raid.id, kind: i % 2 ? "quote" : "reply" })
        .where(eq(contributions.id, id));

    const stats = (await raidStats(t.db, [raid.id], now)).get(raid.id);
    const reads = await Promise.all(ids.map((id) => readContribution(t.db, id, now)));
    const credited = reads.filter((r) => r?.selected && r.selected.point_units !== "0");
    expect(stats?.credited).toBe(credited.length);
    expect(stats?.averageCredited).toBe(
      Math.round(
        credited.reduce((sum, r) => sum + (r?.selected?.credited_quality ?? 0), 0) /
          credited.length,
      ),
    );
    // Upgraded 85 and the open epoch's 70 are credited; the off-topic zero, the unscored, the
    // unresolved and the late one are submitted only; one is still scoring in the open epoch.
    expect(stats).toEqual({
      members: 2,
      replies: 4,
      quotes: 3,
      credited: 2,
      averageCredited: 78,
      scoring: 1,
      epochs: [1, 2],
    });
  });

  it("returns zeros for a raid with no submissions and ignores other raids' work", async () => {
    const { community, member } = await seedCommunity(t.db);
    const quiet = await seedTask(t.db, community.id, new Date());
    const busy = await seedTask(t.db, community.id, new Date());
    await t.db.insert(contributions).values({
      communityId: community.id,
      memberId: member.id,
      taskId: busy.id,
      kind: "reply",
      url: "https://x.com/m/status/9",
      text: "legacy lane reply",
      telegramMessageId: 1,
    });
    const stats = await raidStats(t.db, [quiet.id, busy.id], new Date());
    expect(stats.get(quiet.id)).toEqual({
      members: 0,
      replies: 0,
      quotes: 0,
      credited: 0,
      averageCredited: null,
      scoring: 0,
      epochs: [],
    });
    expect(stats.get(busy.id)).toMatchObject({ members: 1, replies: 1, credited: 0, scoring: 0 });
    expect(await raidStats(t.db, [], new Date())).toEqual(new Map());
  });
});
