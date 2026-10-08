import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { communities, contributions, createDb, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedAuditDemo } from "../http/demo-seed.js";
import { readContribution } from "../http/read-service.js";
import { rubric } from "../rewards/test-db.js";
import { claimRaidRecap } from "./recap.js";
import { raidStats } from "./stats.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use the disposable test:pg runner");
const a = createDb(url);
const b = createDb(url);
const WEB = "https://hyphae.test";
const HOUR = 3_600_000;
beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([a.$client.end(), b.$client.end()]);
});

// Each test owns a far-future instant, so no other suite's raid falls in its recap window.
let slot = 0;
async function endedRaid() {
  slot += 1;
  const now = new Date(Date.UTC(2040, 0, 1) + slot * 10 * 24 * HOUR);
  const [community] = await a
    .insert(communities)
    .values({
      mint: `Recap${randomUUID()}`,
      name: "Recap test",
      telegramChatId: -BigInt(Date.now()) - BigInt(slot),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("community");
  const [task] = await a
    .insert(tasks)
    .values({
      communityId: community.id,
      kind: "raid",
      status: "open",
      targetUrl: "https://x.com/owner/status/1",
      targetAuthor: "owner",
      opensAt: new Date(now.getTime() - 6 * HOUR),
      closesAt: new Date(now.getTime() - 60_000),
    })
    .returning();
  if (!task) throw new Error("task");
  return { now, task };
}

describe("raid recaps on two real Postgres pools", () => {
  it("racing notifiers claim one recap between them", async () => {
    const { now, task } = await endedRaid();
    const claims = await Promise.all([
      claimRaidRecap(a, WEB, now),
      claimRaidRecap(b, WEB, now),
      claimRaidRecap(a, WEB, now),
    ]);
    expect(claims.filter(Boolean).map((c) => c?.taskId)).toEqual([task.id]);
    expect(await claimRaidRecap(b, WEB, now)).toBeUndefined();
  });

  it("skips a raid whose close or cancel is in flight and claims it once that settles", async () => {
    const { now, task } = await endedRaid();
    await b.transaction(async (tx) => {
      await tx.select().from(tasks).where(eq(tasks.id, task.id)).for("no key update");
      expect(await claimRaidRecap(a, WEB, now)).toBeUndefined();
    });
    expect((await claimRaidRecap(a, WEB, now))?.taskId).toBe(task.id);
  });

  it("counts credited work as the public contribution read selects it", async () => {
    const now = new Date();
    const demo = await seedAuditDemo(a, now);
    const [raid] = await a
      .insert(tasks)
      .values({
        communityId: demo.communityId,
        kind: "raid",
        status: "open",
        opensAt: new Date(now.getTime() - 9 * 24 * HOUR),
        closesAt: new Date(now.getTime() + HOUR),
      })
      .returning();
    if (!raid) throw new Error("raid");
    const ids = Object.values(demo.contributions);
    for (const [i, id] of ids.entries())
      await a
        .update(contributions)
        .set({ taskId: raid.id, kind: i % 2 ? "quote" : "reply" })
        .where(eq(contributions.id, id));
    const reads = await Promise.all(ids.map((id) => readContribution(a, id, now)));
    const credited = reads.filter((r) => r?.selected && r.selected.point_units !== "0");
    expect((await raidStats(b, [raid.id], now)).get(raid.id)).toEqual({
      members: 2,
      replies: 4,
      quotes: 3,
      credited: credited.length,
      averageCredited: 78,
      scoring: 1,
      epochs: [1, 2],
    });
    expect(credited).toHaveLength(2);
  });
});
