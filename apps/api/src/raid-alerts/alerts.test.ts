import { raidDeliveries, raidSubscriptions, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { GrammyError } from "grammy";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { at, createTestDb, seedCommunity, type TestDb } from "../rewards/test-db.js";
import { claimRaidAlert, deliverRaidAlert, openRaid, setRaidSubscription } from "./alerts.js";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected fixture/claimed delivery");
  return value;
}

let t: Awaited<ReturnType<typeof createTestDb>>;
const NOW = new Date("2026-11-01T12:00:00Z");
const clock = at(NOW);
const post = { id: "1", handle: "owner", text: "Target", url: "https://x.com/owner/status/1" };
const deps = () => ({
  clock,
  membership: vi.fn(async () => true),
  send: vi.fn(async (_user: bigint, _text: string, _target: string, _stop: string) => undefined),
});
async function raid(
  db: TestDb,
  community: Awaited<ReturnType<typeof seedCommunity>>["community"],
  messageId = 1,
) {
  return openRaid(
    db,
    {
      communityId: community.id,
      chatId: community.telegramChatId,
      actorId: community.adminTelegramUserId,
      messageId,
      hours: 1,
      brief: "Explain your view",
      post,
    },
    clock,
  );
}
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

describe("private raid alerts", () => {
  it("creates no deliveries without explicit opt-in and refuses a different admin/chat", async () => {
    const { community } = await seedCommunity(t.db);
    expect((await raid(t.db, community)).status).toBe("created");
    expect(await claimRaidAlert(t.db, NOW)).toBeUndefined();
    const before = await t.db.select().from(tasks);
    for (const override of [{ actorId: 42n }, { chatId: -999n }]) {
      expect(
        await openRaid(
          t.db,
          {
            communityId: community.id,
            chatId: community.telegramChatId,
            actorId: community.adminTelegramUserId,
            messageId: 2,
            hours: 1,
            brief: "",
            post,
            ...override,
          },
          clock,
        ),
      ).toEqual({ status: "unauthorized" });
    }
    expect(await t.db.select().from(tasks)).toEqual(before);
  });
  it("keeps communities isolated and deduplicates the original Telegram raid update", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    await setRaidSubscription(t.db, a.community.id, 42n, true, clock);
    await setRaidSubscription(t.db, b.community.id, 99n, true, clock);
    const first = await raid(t.db, a.community);
    expect((await raid(t.db, a.community)).status).toBe("existing");
    const delivery = await claimRaidAlert(t.db, NOW);
    expect(delivery).toBeDefined();
    const d = deps();
    expect(await deliverRaidAlert(t.db, required(delivery).id, d)).toBe("sent");
    expect(d.membership).toHaveBeenCalledWith(a.community.telegramChatId, 42n);
    expect(d.send.mock.calls[0]?.[0]).toBe(42n);
    expect(d.send.mock.calls[0]?.[1]).toContain(a.community.name);
    expect(d.send.mock.calls[0]?.[1]).toContain(post.url);
    expect(d.send.mock.calls[0]?.[1]).toContain("Explain your view");
    expect(d.send.mock.calls[0]?.[1]).toContain("/submit");
    expect(await claimRaidAlert(t.db, NOW)).toBeUndefined();
    expect(first.status).toBe("created");
  });
  it("does not backfill old raids, and repeated opt-in preserves pending new alerts", async () => {
    const { community } = await seedCommunity(t.db);
    const first = await raid(t.db, community);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    expect(await claimRaidAlert(t.db, NOW)).toBeUndefined();
    if (first.status !== "created") throw new Error("raid");
    await t.db.update(tasks).set({ status: "closed" }).where(eq(tasks.id, first.task.id));
    await raid(t.db, community, 2);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    const d = deps();
    const job = await claimRaidAlert(t.db, NOW);
    expect(await deliverRaidAlert(t.db, required(job).id, d)).toBe("sent");
    expect(d.send).toHaveBeenCalledTimes(1);
  });
  it("a stop followed by re-opt-in cannot revive alerts queued under old consent", async () => {
    const { community } = await seedCommunity(t.db);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    await raid(t.db, community);
    await setRaidSubscription(t.db, community.id, 42n, false, clock);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    const d = deps();
    const job = await claimRaidAlert(t.db, NOW);
    expect(await deliverRaidAlert(t.db, required(job).id, d)).toBe("skipped");
    expect(d.send).not.toHaveBeenCalled();
  });
  it("checks current membership and disables only that community on departure", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    await setRaidSubscription(t.db, a.community.id, 42n, true, clock);
    await setRaidSubscription(t.db, b.community.id, 42n, true, clock);
    await raid(t.db, a.community);
    const d = deps();
    d.membership.mockResolvedValue(false);
    expect(await deliverRaidAlert(t.db, required(await claimRaidAlert(t.db, NOW)).id, d)).toBe(
      "skipped",
    );
    expect(d.send).not.toHaveBeenCalled();
    const subs = await t.db
      .select()
      .from(raidSubscriptions)
      .where(eq(raidSubscriptions.telegramUserId, 42n));
    expect(subs.find((s) => s.communityId === a.community.id)?.enabled).toBe(false);
    expect(subs.find((s) => s.communityId === b.community.id)?.enabled).toBe(true);
  });
  it("does not send expired or closed targets", async () => {
    for (const expired of [true, false]) {
      const { community } = await seedCommunity(t.db);
      await setRaidSubscription(t.db, community.id, 42n, true, clock);
      const opened = await raid(t.db, community);
      if (opened.status !== "created") throw new Error("raid");
      if (!expired)
        await t.db.update(tasks).set({ status: "closed" }).where(eq(tasks.id, opened.task.id));
      const d = { ...deps(), clock: expired ? at(new Date(NOW.getTime() + 3_600_000)) : clock };
      expect(await deliverRaidAlert(t.db, required(await claimRaidAlert(t.db, NOW)).id, d)).toBe(
        "skipped",
      );
      expect(d.send).not.toHaveBeenCalled();
    }
  });
  it("a lookup outage retries without sending, and uncertain sends never retry", async () => {
    const { community } = await seedCommunity(t.db);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    await raid(t.db, community);
    const job = required(await claimRaidAlert(t.db, NOW));
    const d = deps();
    d.membership.mockRejectedValue(new Error("lookup failed"));
    expect(await deliverRaidAlert(t.db, job.id, d)).toBe("pending");
    expect(d.send).not.toHaveBeenCalled();
    await t.db
      .update(raidDeliveries)
      .set({ nextAttemptAt: NOW })
      .where(eq(raidDeliveries.id, job.id));
    await claimRaidAlert(t.db, NOW);
    d.membership.mockResolvedValue(true);
    d.send.mockRejectedValue(new Error("ambiguous request with private token"));
    expect(await deliverRaidAlert(t.db, job.id, d)).toBe("uncertain");
    expect(await deliverRaidAlert(t.db, job.id, d)).toBe("uncertain");
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(
      (await t.db.select().from(raidDeliveries).where(eq(raidDeliveries.id, job.id)))[0]?.reason,
    ).toBe("send_unknown");
  });
  it("Telegram 429 waits for retry_after; a blocked bot stops alerts without duplicating a successful send", async () => {
    const { community } = await seedCommunity(t.db);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    await raid(t.db, community);
    const job = required(await claimRaidAlert(t.db, NOW));
    const d = deps();
    d.send.mockRejectedValue(
      new GrammyError(
        "limited",
        { ok: false, error_code: 429, description: "limited", parameters: { retry_after: 90 } },
        "sendMessage",
        {},
      ),
    );
    expect(await deliverRaidAlert(t.db, job.id, d)).toBe("pending");
    const [row] = await t.db.select().from(raidDeliveries).where(eq(raidDeliveries.id, job.id));
    expect(row?.nextAttemptAt).toEqual(new Date(NOW.getTime() + 90_000));
    expect(await claimRaidAlert(t.db, NOW)).toBeUndefined();
    await claimRaidAlert(t.db, new Date(NOW.getTime() + 90_000));
    d.send.mockRejectedValue(
      new GrammyError(
        "blocked",
        { ok: false, error_code: 403, description: "blocked" },
        "sendMessage",
        {},
      ),
    );
    expect(await deliverRaidAlert(t.db, job.id, d)).toBe("failed");
    expect(
      (
        await t.db
          .select()
          .from(raidSubscriptions)
          .where(eq(raidSubscriptions.communityId, community.id))
      )[0]?.enabled,
    ).toBe(false);
  });
  it("a failed receipt write cannot hand the same claimed delivery to another sender", async () => {
    const { community } = await seedCommunity(t.db);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    await raid(t.db, community);
    const job = required(await claimRaidAlert(t.db, NOW));
    const d = deps();
    let calls = 0;
    const failReceipt = async () => {
      if (++calls > 2) throw new Error("receipt write failed");
      return NOW;
    };
    await expect(deliverRaidAlert(t.db, job.id, { ...d, clock: failReceipt })).rejects.toThrow(
      "receipt write failed",
    );
    expect(await deliverRaidAlert(t.db, job.id, d)).toBe("sending");
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(await claimRaidAlert(t.db, new Date(NOW.getTime() + 61_000))).toBeUndefined();
    expect(await deliverRaidAlert(t.db, job.id, d)).toBe("uncertain");
    expect(d.send).toHaveBeenCalledTimes(1);
  });
  it("refuses a mismatched community target and rechecks deadline after membership lookup", async () => {
    const { community } = await seedCommunity(t.db);
    const other = await seedCommunity(t.db);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    const opened = await raid(t.db, community);
    if (opened.status !== "created") throw new Error("raid");
    await t.db
      .update(tasks)
      .set({ communityId: other.community.id })
      .where(eq(tasks.id, opened.task.id));
    const d = deps();
    expect(await deliverRaidAlert(t.db, required(await claimRaidAlert(t.db, NOW)).id, d)).toBe(
      "skipped",
    );
    expect(d.membership).not.toHaveBeenCalled();
    expect(d.send).not.toHaveBeenCalled();
    await raid(t.db, community, 2);
    const job = required(await claimRaidAlert(t.db, NOW));
    const elapsed = at(new Date(NOW.getTime() + 3_600_000));
    expect(await deliverRaidAlert(t.db, job.id, { ...d, clock: elapsed })).toBe("skipped");
    expect(d.send).not.toHaveBeenCalled();
  });
  it("expired raids do not retry a failing membership lookup forever", async () => {
    const { community } = await seedCommunity(t.db);
    await setRaidSubscription(t.db, community.id, 42n, true, clock);
    await raid(t.db, community);
    const d = deps();
    d.membership.mockRejectedValue(new Error("permanently removed bot"));
    const job = required(await claimRaidAlert(t.db, NOW));
    expect(
      await deliverRaidAlert(t.db, job.id, {
        ...d,
        clock: at(new Date(NOW.getTime() + 3_600_000)),
      }),
    ).toBe("skipped");
    expect(d.membership).not.toHaveBeenCalled();
    expect(d.send).not.toHaveBeenCalled();
  });
});
