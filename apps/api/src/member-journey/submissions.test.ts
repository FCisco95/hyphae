import {
  contributions,
  members,
  raidSubmissionReceipts,
  raidSubmissionSessions,
  rewardIntakes,
  tasks,
} from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  at,
  createTestDb,
  seedCommunity,
  seedRewardLane,
  seedTask,
  T0,
} from "../rewards/test-db.js";
import {
  acceptSubmission,
  beginSubmission,
  cancelSubmission,
  queueSubmission,
  type SubmissionDeps,
} from "./submissions.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
const NOW = new Date(T0.getTime() + 60_000);
const clock = at(NOW);
const URL = "https://x.com/member/status/222";
const post = { id: "222", handle: "member", text: "My reply", url: URL };
const deps = (): SubmissionDeps & {
  membership: ReturnType<typeof vi.fn>;
  fetchPost: ReturnType<typeof vi.fn>;
} => ({ clock, membership: vi.fn(async () => true), fetchPost: vi.fn(async () => post) });
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});
async function setup(reward = false, kind: "reply" | "quote" = "reply") {
  const { community, member } = reward ? await seedRewardLane(t.db) : await seedCommunity(t.db);
  const task = await seedTask(t.db, community.id, T0);
  await t.db.update(tasks).set({ telegramMessageId: 777 }).where(eq(tasks.id, task.id));
  const d = deps();
  const opened = await beginSubmission(t.db, task.id, member.telegramUserId, kind, d);
  if (!("session" in opened)) throw new Error("Missing prompt");
  return {
    community,
    member,
    task,
    d,
    session: opened.session,
    input: { sessionId: opened.session.id, userId: member.telegramUserId, url: URL },
  };
}
describe("explicit private raid submissions", () => {
  it.each([false, true])(
    "binds caller, community, exact raid and kind; does not claim proof (reward=%s)",
    async (reward) => {
      const { community, member, task, d, input } = await setup(reward, "quote");
      await seedTask(t.db, community.id, NOW); // A more recent task must never steal the submission.
      const result = await acceptSubmission(t.db, input, d);
      expect("receipt" in result).toBe(true);
      if (!("receipt" in result)) throw new Error("Expected receipt");
      expect(result.lane).toBe(reward ? "reward" : "legacy");
      expect(result.receipt).toMatchObject({
        communityId: community.id,
        memberId: member.id,
        taskId: task.id,
        relationStatus: "unverified",
        ownershipStatus: "unverified",
        queueStatus: "pending",
      });
      const c = await t.db.query.contributions.findFirst({
        where: eq(contributions.id, result.receipt.contributionId),
      });
      expect(c).toMatchObject({ taskId: task.id, kind: "quote", telegramMessageId: 777 });
      expect(d.membership).toHaveBeenCalledWith(community.telegramChatId, member.telegramUserId);
      if (reward) {
        const intake = await t.db.query.rewardIntakes.findFirst({
          where: eq(rewardIntakes.contributionId, result.receipt.contributionId),
        });
        expect(intake?.capture).toMatchObject({
          limitations: ["text_only"],
        });
      }
    },
  );
  it("rejects forged callers, mismatched membership, unknown prompts and wrong-community task", async () => {
    const { d, input, task } = await setup();
    expect(await acceptSubmission(t.db, { ...input, userId: 99n }, d)).toEqual({
      error: "unavailable",
    });
    const b = await seedCommunity(t.db);
    d.membership.mockImplementation(async (chat: bigint) => chat === b.community.telegramChatId);
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "not_member" });
    expect(d.fetchPost).not.toHaveBeenCalled();
    d.membership.mockResolvedValue(true);
    await t.db.update(tasks).set({ communityId: b.community.id }).where(eq(tasks.id, task.id));
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "outside_window" });
  });
  it("checks membership again after evidence retrieval and refuses revoked membership", async () => {
    const { d, input } = await setup();
    d.membership.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "not_member" });
    expect(
      await t.db.query.raidSubmissionReceipts.findFirst({
        where: eq(raidSubmissionReceipts.sessionId, input.sessionId),
      }),
    ).toBeUndefined();
  });
  it("membership outage and unreadable post never report receipt success", async () => {
    const { d, input } = await setup();
    d.membership.mockRejectedValueOnce(new Error("outage"));
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "membership_unavailable" });
    d.fetchPost.mockResolvedValueOnce(null);
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "post_unavailable" });
    d.fetchPost.mockRejectedValueOnce(new Error("outage"));
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "post_unavailable" });
  });
  it("rejects the target itself, cancellation, prompt expiry, and task closing during fetch", async () => {
    const { d, input, task } = await setup();
    expect(await acceptSubmission(t.db, { ...input, url: "https://x.com/a/status/1" }, d)).toEqual({
      error: "target_itself",
    });
    expect(await cancelSubmission(t.db, input.sessionId, 99n)).toBe(false);
    expect(await cancelSubmission(t.db, input.sessionId, input.userId)).toBe(true);
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "session_expired" });
    const fresh = await beginSubmission(t.db, task.id, input.userId, "reply", d);
    if (!("session" in fresh)) throw new Error("prompt");
    const again = { ...input, sessionId: fresh.session.id };
    expect(
      await acceptSubmission(t.db, again, {
        ...d,
        clock: at(new Date(NOW.getTime() + 15 * 60_000)),
      }),
    ).toEqual({ error: "session_expired" });
    d.fetchPost.mockImplementationOnce(async () => {
      await t.db.update(tasks).set({ status: "closed" }).where(eq(tasks.id, task.id));
      return post;
    });
    expect(await acceptSubmission(t.db, again, d)).toEqual({ error: "task_closed" });
  });
  it("returns the same receipt on retries, including after expiry, and retries failed dispatch", async () => {
    const { d, input } = await setup(true);
    const first = await acceptSubmission(t.db, input, d);
    if (!("receipt" in first)) throw new Error("receipt");
    const enqueue = vi.fn(async () => {
      throw new Error("queue down");
    });
    expect(await queueSubmission(t.db, first.receipt, enqueue)).toBe(false);
    const again = await acceptSubmission(t.db, input, {
      ...d,
      clock: at(new Date(NOW.getTime() + 3_600_000)),
    });
    expect(again).toMatchObject({ receipt: { id: first.receipt.id }, replay: true });
    expect(d.fetchPost).toHaveBeenCalledTimes(1);
    const send = vi.fn(async () => "job");
    expect(await queueSubmission(t.db, first.receipt, send)).toBe(true);
    const latest = await t.db.query.raidSubmissionReceipts.findFirst({
      where: eq(raidSubmissionReceipts.id, first.receipt.id),
    });
    if (!latest) throw new Error("receipt");
    expect(await queueSubmission(t.db, latest, send)).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      await acceptSubmission(t.db, { ...input, url: "https://x.com/m/status/333" }, d),
    ).toEqual({ error: "unavailable" });
  });
  it("deduplicates across prompts and caps one reply/quote per member per raid", async () => {
    const { d, input, task } = await setup();
    expect(await acceptSubmission(t.db, input, d)).toHaveProperty("receipt");
    const second = await beginSubmission(t.db, task.id, input.userId, "reply", d);
    if (!("session" in second)) throw new Error("prompt");
    expect(await acceptSubmission(t.db, { ...input, sessionId: second.session.id }, d)).toEqual({
      error: "duplicate_artifact",
    });
    d.fetchPost.mockResolvedValue({ ...post, id: "333", url: "https://x.com/member/status/333" });
    expect(
      await acceptSubmission(
        t.db,
        { ...input, sessionId: second.session.id, url: "https://x.com/member/status/333" },
        d,
      ),
    ).toEqual({ error: "kind_taken" });
  });
  it("preserves handle cap as an unverified claim and requires linked membership", async () => {
    const { d, member, task, input } = await setup();
    expect(await beginSubmission(t.db, task.id, 99n, "reply", d)).toEqual({
      error: "link_required",
    });
    await t.db
      .update(members)
      .set({ xHandles: ["one", "two", "three"] })
      .where(eq(members.id, member.id));
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "handle_limit" });
    expect(
      await t.db.query.raidSubmissionReceipts.findFirst({
        where: eq(raidSubmissionReceipts.sessionId, input.sessionId),
      }),
    ).toBeUndefined();
    expect(
      await t.db.query.raidSubmissionSessions.findFirst({
        where: eq(raidSubmissionSessions.id, input.sessionId),
      }),
    ).toBeDefined();
  });
  it("rejects duplicate/kind exhaustion before Telegram or provider work", async () => {
    const { d, input, task } = await setup();
    expect(await acceptSubmission(t.db, input, d)).toHaveProperty("receipt");
    const second = await beginSubmission(t.db, task.id, input.userId, "reply", d);
    if (!("session" in second)) throw new Error("prompt");
    d.membership.mockClear();
    d.fetchPost.mockClear();
    expect(await acceptSubmission(t.db, { ...input, sessionId: second.session.id }, d)).toEqual({
      error: "duplicate_artifact",
    });
    expect(d.membership).not.toHaveBeenCalled();
    expect(d.fetchPost).not.toHaveBeenCalled();
    expect(
      await acceptSubmission(
        t.db,
        { ...input, sessionId: second.session.id, url: "https://x.com/member/status/333" },
        d,
      ),
    ).toEqual({ error: "kind_taken" });
    expect(d.membership).not.toHaveBeenCalled();
    expect(d.fetchPost).not.toHaveBeenCalled();
  });
  it("refuses a raid with no group message reference instead of writing message zero", async () => {
    const { d, input, task } = await setup();
    await t.db.update(tasks).set({ telegramMessageId: null }).where(eq(tasks.id, task.id));
    expect(await acceptSubmission(t.db, input, d)).toEqual({ error: "unavailable" });
    expect(d.fetchPost).not.toHaveBeenCalled();
  });
  it("serializes queue retries even when callers both hold a stale pending receipt", async () => {
    const { d, input } = await setup();
    const accepted = await acceptSubmission(t.db, input, d);
    if (!("receipt" in accepted)) throw new Error("receipt");
    const enqueue = vi.fn(async () => "job");
    const results = await Promise.all([
      queueSubmission(t.db, accepted.receipt, enqueue),
      queueSubmission(t.db, accepted.receipt, enqueue),
    ]);
    expect(results).toEqual([true, true]);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
  it("does not confirm queued when the queue declined the job", async () => {
    const { d, input } = await setup();
    const accepted = await acceptSubmission(t.db, input, d);
    if (!("receipt" in accepted)) throw new Error("receipt");
    expect(await queueSubmission(t.db, accepted.receipt, async () => null)).toBe(false);
    expect(
      (
        await t.db.query.raidSubmissionReceipts.findFirst({
          where: eq(raidSubmissionReceipts.id, accepted.receipt.id),
        })
      )?.queueStatus,
    ).toBe("pending");
  });
  it("retains the first cancellation timestamp on retry", async () => {
    const { input } = await setup();
    await cancelSubmission(t.db, input.sessionId, input.userId);
    const first = await t.db.query.raidSubmissionSessions.findFirst({
      where: eq(raidSubmissionSessions.id, input.sessionId),
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await cancelSubmission(t.db, input.sessionId, input.userId)).toBe(true);
    const again = await t.db.query.raidSubmissionSessions.findFirst({
      where: eq(raidSubmissionSessions.id, input.sessionId),
    });
    expect(again?.cancelledAt).toEqual(first?.cancelledAt);
  });
  it("bounds abandoned prompts per caller/community while preserving existing prompts", async () => {
    const { d, input, task, community } = await setup();
    for (let i = 0; i < 9; i++)
      expect(await beginSubmission(t.db, task.id, input.userId, "reply", d)).toHaveProperty(
        "session",
      );
    expect(await beginSubmission(t.db, task.id, input.userId, "quote", d)).toEqual({
      error: "prompt_limited",
    });
    expect(await acceptSubmission(t.db, input, d)).toHaveProperty("receipt");
    const other = await seedCommunity(t.db);
    const otherTask = await seedTask(t.db, other.community.id, T0);
    await t.db.update(tasks).set({ telegramMessageId: 3 }).where(eq(tasks.id, otherTask.id));
    expect(await beginSubmission(t.db, otherTask.id, input.userId, "reply", d)).toHaveProperty(
      "session",
    );
    expect(
      await beginSubmission(t.db, task.id, input.userId, "quote", {
        ...d,
        clock: at(new Date(NOW.getTime() + 3_600_001)),
      }),
    ).toHaveProperty("session");
    expect(community.id).not.toBe(other.community.id);
  });
});
