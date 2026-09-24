import { epochs, rewardDecisions, rewardEpochSnapshots, rewardSnapshotEntries } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { walletAt } from "../link/wallet-links.js";
import { createTestDb } from "../rewards/test-db.js";
import { seedAuditDemo } from "./demo-seed.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");

describe("seedAuditDemo", () => {
  it("builds a closed epoch with every state and an open one, through the reward functions", async () => {
    const demo = await seedAuditDemo(t.db, NOW);

    const rows = await t.db
      .select()
      .from(epochs)
      .where(eq(epochs.communityId, demo.communityId))
      .orderBy(asc(epochs.index));
    expect(rows.map((e) => [e.index, e.status])).toEqual([
      [1, "closed"],
      [2, "open"],
    ]);
    expect(rows[1]?.opensAt.getTime()).toBeLessThan(NOW.getTime());
    expect(rows[1]?.closesAt.getTime()).toBeGreaterThan(NOW.getTime());

    const [snapshot] = await t.db
      .select()
      .from(rewardEpochSnapshots)
      .where(eq(rewardEpochSnapshots.epochId, rows[0]?.id ?? ""));
    const entries = await t.db
      .select()
      .from(rewardSnapshotEntries)
      .where(eq(rewardSnapshotEntries.snapshotId, snapshot?.id ?? ""));
    const reasonOf = (id: string) => {
      const e = entries.find((x) => x.contributionId === id);
      return e ? (e.reason ?? `selected r${e.revision}`) : undefined;
    };
    const c = demo.contributions;
    expect(reasonOf(c.upgraded)).toBe("selected r2");
    expect(reasonOf(c.offTopic)).toBe("selected r1");
    expect(reasonOf(c.pendingAtClose)).toBe("pending_at_close");
    expect(reasonOf(c.reconciling)).toBe("pending_reconciliation");
    expect(reasonOf(c.late)).toBe("excluded");
    expect(entries.find((e) => e.contributionId === c.upgraded)?.pointUnits).toBe(25_500_000_000n);

    const offTopic = await t.db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.contributionId, c.offTopic))
      .orderBy(asc(rewardDecisions.revision));
    expect(offTopic.map((d) => [d.rawQuality, d.creditedQuality, d.affectsAllocation])).toEqual([
      [84, 0, true],
      [84, 84, false],
    ]);
    expect(offTopic[1]?.correctionActor).toBe("admin:cisco");

    expect((await walletAt(t.db, demo.members.signed, rows[0]?.closesAt ?? NOW))?.method).toBe(
      "signature",
    );
    expect((await walletAt(t.db, demo.members.pasted, NOW))?.method).toBe("paste");
    expect(demo.contributions.openCounted).toBeTruthy();
    expect(demo.contributions.openPending).toBeTruthy();
  });
});
