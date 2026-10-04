import { randomUUID } from "node:crypto";
import { communities, contributions, raidLifecycleEvents, scoringRuns, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { at, createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import { type RaidTransition, raidState, transitionRaid } from "./lifecycle.js";

const NOW = new Date("2026-11-01T12:00:00Z");
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

async function fixture() {
  const { community, member } = await seedCommunity(t.db);
  const task = await seedTask(t.db, community.id, NOW);
  const input: RaidTransition = {
    communityId: community.id,
    taskId: task.id,
    chatId: community.telegramChatId,
    actorId: community.adminTelegramUserId,
    messageId: 10,
    action: "closed",
    reason: "Completed the brief",
  };
  return { community, member, task, input };
}

describe("raid lifecycle state", () => {
  const task = {
    status: "open" as const,
    opensAt: NOW,
    closesAt: new Date(NOW.getTime() + 3_600_000),
  };
  it("distinguishes upcoming, active and expiry at the exact deadline", () => {
    expect(raidState(task, null, new Date(NOW.getTime() - 1))).toBe("upcoming");
    expect(raidState(task, null, NOW)).toBe("active");
    expect(raidState(task, null, new Date(task.closesAt.getTime() - 1))).toBe("active");
    expect(raidState(task, null, task.closesAt)).toBe("expired");
  });
  it("shows terminal decisions after the window, and does not call proposals active", () => {
    expect(raidState({ ...task, status: "closed" }, null, NOW)).toBe("closed");
    expect(raidState(task, { action: "closed" }, task.closesAt)).toBe("closed");
    expect(raidState(task, { action: "cancelled" }, task.closesAt)).toBe("cancelled");
    expect(raidState({ ...task, status: "proposed" }, null, NOW)).toBe("proposed");
    expect(raidState({ ...task, status: "rejected" }, null, NOW)).toBe("rejected");
  });
});

describe("authorized raid terminal actions", () => {
  it("records a required reason, actor and receipt while retaining the original window", async () => {
    const { input, task } = await fixture();
    const result = await transitionRaid(t.db, input, at(NOW));
    expect(result).toMatchObject({
      status: "changed",
      state: "closed",
      task: { ...task, status: "closed" },
      event: {
        communityId: input.communityId,
        taskId: task.id,
        action: "closed",
        actorTelegramUserId: input.actorId,
        reason: input.reason,
        telegramMessageId: 10,
        createdAt: NOW,
      },
    });
  });
  it("rejects unauthorized callers and the wrong registered group without changing a task", async () => {
    const { input, task } = await fixture();
    for (const override of [{ actorId: 42n }, { chatId: -9999n }]) {
      expect(await transitionRaid(t.db, { ...input, ...override }, at(NOW))).toEqual({
        status: "unauthorized",
      });
    }
    expect(await t.db.select().from(tasks).where(eq(tasks.id, task.id))).toEqual([task]);
    expect(
      await t.db.select().from(raidLifecycleEvents).where(eq(raidLifecycleEvents.taskId, task.id)),
    ).toEqual([]);
  });
  it("rechecks the designated admin on retries after their authority has been revoked", async () => {
    const { input } = await fixture();
    expect((await transitionRaid(t.db, input, at(NOW))).status).toBe("changed");
    await t.db
      .update(communities)
      .set({ adminTelegramUserId: 8n })
      .where(eq(communities.id, input.communityId));
    expect(await transitionRaid(t.db, input, at(NOW))).toEqual({ status: "unauthorized" });
    expect((await transitionRaid(t.db, { ...input, actorId: 8n }, at(NOW))).status).toBe(
      "existing",
    );
  });
  it("rejects foreign community tasks, unknown tasks and non-raid tasks", async () => {
    const a = await fixture();
    const b = await fixture();
    for (const taskId of [b.task.id, randomUUID()]) {
      expect(await transitionRaid(t.db, { ...a.input, taskId }, at(NOW))).toEqual({
        status: "not_found",
      });
    }
    await t.db.update(tasks).set({ kind: "open" }).where(eq(tasks.id, a.task.id));
    expect(await transitionRaid(t.db, a.input, at(NOW))).toEqual({ status: "not_found" });
    expect(await t.db.select().from(tasks).where(eq(tasks.id, b.task.id))).toEqual([b.task]);
  });
  it("validates bounded nonempty reasons and identifiers before mutation", async () => {
    const { input, task } = await fixture();
    for (const override of [
      { reason: " \n " },
      { reason: "a".repeat(501) },
      { taskId: "not-a-uuid" },
      { communityId: "not-a-uuid" },
      { chatId: 42n },
      { actorId: 0n },
      { messageId: 0 },
    ])
      expect(await transitionRaid(t.db, { ...input, ...override }, at(NOW))).toEqual({
        status: "invalid",
      });
    expect(await t.db.select().from(tasks).where(eq(tasks.id, task.id))).toEqual([task]);
  });
  it("makes duplicate retries idempotent without rewriting the original actor or reason", async () => {
    const { input, task } = await fixture();
    const results = await Promise.all([
      transitionRaid(t.db, input, at(NOW)),
      transitionRaid(t.db, { ...input, messageId: 11, reason: "Replacement reason" }, at(NOW)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["changed", "existing"]);
    const events = await t.db
      .select()
      .from(raidLifecycleEvents)
      .where(eq(raidLifecycleEvents.taskId, task.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.reason).toBe(input.reason);
    expect(events[0]?.telegramMessageId).toBe(input.messageId);
  });
  it("does not replace a terminal decision or retrofit a cancellation onto a legacy closure", async () => {
    for (const initial of ["closed", "cancelled"] as const) {
      const { input } = await fixture();
      const result = await transitionRaid(t.db, { ...input, action: initial }, at(NOW));
      expect(result.status).toBe("changed");
      const other = initial === "closed" ? "cancelled" : "closed";
      expect(await transitionRaid(t.db, { ...input, action: other }, at(NOW))).toEqual({
        status: "terminal",
        state: initial,
      });
    }
    const { input } = await fixture();
    await t.db.update(tasks).set({ status: "closed" }).where(eq(tasks.id, input.taskId));
    expect(await transitionRaid(t.db, { ...input, action: "cancelled" }, at(NOW))).toEqual({
      status: "terminal",
      state: "closed",
    });
  });
  it("can explicitly close an expired raid without changing its original deadline", async () => {
    const { input, task } = await fixture();
    const result = await transitionRaid(t.db, input, at(task.closesAt));
    expect(result).toMatchObject({
      status: "changed",
      state: "closed",
      task: { closesAt: task.closesAt },
      event: { createdAt: task.closesAt },
    });
  });
  it("cancellation preserves submitted work, scoring history and the opened audit event", async () => {
    const { input, member, task } = await fixture();
    await t.db.insert(raidLifecycleEvents).values({
      communityId: input.communityId,
      taskId: input.taskId,
      actorTelegramUserId: input.actorId,
      action: "opened",
      reason: "Original brief",
      telegramMessageId: 1,
      createdAt: NOW,
    });
    const [contribution] = await t.db
      .insert(contributions)
      .values({
        communityId: input.communityId,
        memberId: member.id,
        taskId: task.id,
        kind: "reply",
        url: "https://x.com/member/status/2",
        text: "Member's submitted work",
        telegramMessageId: 2,
        submittedAt: NOW,
      })
      .returning();
    if (!contribution) throw new Error("fixture contribution");
    await t.db.insert(scoringRuns).values({
      contributionId: contribution.id,
      model: "fixture", // Fixture only; no model routing or inference call.
      rubricVersion: "1.2.0",
      promptHash: "fixture",
      input: {},
      output: {},
      score: 80,
      timingMultiplier: 10_000,
      flags: [],
      reasoning: "Fixture score",
      latencyMs: 0,
      costMicroUsd: 0,
      evidenceHash: randomUUID(),
    });
    const before = await t.db
      .select()
      .from(scoringRuns)
      .where(eq(scoringRuns.contributionId, contribution.id));
    expect(
      await transitionRaid(
        t.db,
        { ...input, action: "cancelled", reason: "Target removed" },
        at(NOW),
      ),
    ).toMatchObject({ status: "changed", state: "cancelled", task: { status: "closed" } });
    expect(
      await t.db.select().from(contributions).where(eq(contributions.id, contribution.id)),
    ).toEqual([contribution]);
    expect(
      await t.db.select().from(scoringRuns).where(eq(scoringRuns.contributionId, contribution.id)),
    ).toEqual(before);
    expect(
      (
        await t.db.select().from(raidLifecycleEvents).where(eq(raidLifecycleEvents.taskId, task.id))
      ).map((event) => event.action),
    ).toEqual(["opened", "cancelled"]);
  });
});
