import { raidRecaps, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { GrammyError } from "grammy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { transitionRaid } from "../member-journey/lifecycle.js";
import { at, createTestDb, seedCommunity, seedTask } from "../rewards/test-db.js";
import { claimRaidRecap, deliverRaidRecap, recapText } from "./recap.js";
import type { RaidStats } from "./stats.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const WEB = "https://hyphae.test/";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const stats = (s: Partial<RaidStats> = {}): RaidStats => ({
  members: 0,
  replies: 0,
  quotes: 0,
  credited: 0,
  averageCredited: null,
  scoring: 0,
  epochs: [],
  ...s,
});
const input = { handle: "owner", url: "https://x.com/owner/status/1", webBase: WEB, mint: "MINT" };

describe("recap text", () => {
  it("states counts, the credited average, unfinished scoring and the epoch page", () => {
    expect(
      recapText({
        ...input,
        closed: true,
        ranMs: 11 * HOUR + 42 * MIN,
        stats: stats({
          members: 5,
          replies: 4,
          quotes: 2,
          credited: 3,
          averageCredited: 71,
          scoring: 2,
          epochs: [2],
        }),
      }),
    ).toBe(
      [
        "Raid closed — @owner:",
        "https://x.com/owner/status/1",
        "Ran for 11h 42m.",
        "5 members took part: 4 replies, 2 quotes.",
        "Credited so far: 3 of 6, average credited score 71.",
        "2 still being scored and may be credited later.",
        "Epoch 2 results: https://hyphae.test/c/MINT/e/2",
      ].join("\n"),
    );
  });
  it("uses singular forms, omits a missing average and links every epoch the work landed in", () => {
    expect(
      recapText({
        ...input,
        closed: false,
        ranMs: 12 * HOUR,
        stats: stats({ members: 1, replies: 1, epochs: [2, 3] }),
      }),
    ).toBe(
      [
        "Raid ended — @owner:",
        "https://x.com/owner/status/1",
        "Ran for 12h.",
        "1 member took part: 1 reply, 0 quotes.",
        "Credited so far: 0 of 1.",
        "Epoch 2 results: https://hyphae.test/c/MINT/e/2",
        "Epoch 3 results: https://hyphae.test/c/MINT/e/3",
      ].join("\n"),
    );
  });
  it("says so when nobody submitted and links the community page", () => {
    expect(recapText({ ...input, closed: false, ranMs: 6 * HOUR, stats: stats() })).toBe(
      [
        "Raid ended — @owner:",
        "https://x.com/owner/status/1",
        "Ran for 6h.",
        "No submissions.",
        "Results: https://hyphae.test/c/MINT",
      ].join("\n"),
    );
  });
});

// Each test runs at its own instant, ten days apart, so one test's raids never fall in
// another's one-hour recap window.
let slot = 0;
async function fixture() {
  slot += 1;
  const now = new Date(Date.UTC(2031, 0, 1) + slot * 10 * 24 * HOUR);
  const { community } = await seedCommunity(t.db);
  return { now, community };
}
const sends: { chatId: bigint; text: string }[] = [];
const ok = {
  send: async (chatId: bigint, text: string) => {
    sends.push({ chatId, text });
    return { message_id: 77 };
  },
};
const failing = (err: unknown) => ({
  send: async () => {
    throw err;
  },
});
const rateLimit = (parameters?: { retry_after?: number }) =>
  new GrammyError(
    "Too Many Requests",
    {
      ok: false,
      error_code: 429,
      description: "Too Many Requests",
      ...(parameters && { parameters }),
    },
    "sendMessage",
    {},
  );
const recapOf = async (taskId: string) =>
  (await t.db.select().from(raidRecaps).where(eq(raidRecaps.taskId, taskId)))[0];
// A raid whose 48h window ended `ago` ms before `now`.
const expired = (communityId: string, now: Date, ago: number) =>
  seedTask(t.db, communityId, new Date(now.getTime() - 48 * HOUR - ago));
const end = (
  community: { id: string; telegramChatId: bigint },
  taskId: string,
  action: "closed" | "cancelled",
  when: Date,
) =>
  transitionRaid(
    t.db,
    {
      communityId: community.id,
      taskId,
      chatId: community.telegramChatId,
      actorId: 7n,
      messageId: 1,
      action,
      reason: "Done",
    },
    at(when),
  );

describe("recap claims", () => {
  it("recaps a raid whose window ended within the hour exactly once", async () => {
    const { now, community } = await fixture();
    const task = await expired(community.id, now, 10 * MIN);
    const claim = await claimRaidRecap(t.db, WEB, now);
    expect(claim?.taskId).toBe(task.id);
    expect(claim?.chatId).toBe(community.telegramChatId);
    expect(claim?.text).toContain("Raid ended — @?:");
    expect(claim?.text).toContain("Ran for 48h.");
    expect(claim?.text).toContain(`Results: https://hyphae.test/c/${community.mint}`);
    expect(await claimRaidRecap(t.db, WEB, now)).toBeUndefined();
    if (!claim) throw new Error("claim");
    expect(await deliverRaidRecap(t.db, claim, ok)).toBe("sent");
    expect(await recapOf(task.id)).toMatchObject({ status: "sent", telegramMessageId: 77 });
    expect(await claimRaidRecap(t.db, WEB, new Date(now.getTime() + MIN))).toBeUndefined();
  });

  it("recaps an admin close with its real duration", async () => {
    const { now, community } = await fixture();
    const task = await seedTask(t.db, community.id, new Date(now.getTime() - 2 * HOUR));
    expect(await claimRaidRecap(t.db, WEB, now)).toBeUndefined();
    expect((await end(community, task.id, "closed", now)).status).toBe("changed");
    const claim = await claimRaidRecap(t.db, WEB, new Date(now.getTime() + MIN));
    expect(claim?.text.split("\n").slice(0, 3)).toEqual([
      "Raid closed — @?:",
      "https://x.com/a/status/1",
      "Ran for 2h.",
    ]);
  });

  it("never recaps a cancelled raid, an old raid or a brief", async () => {
    const { now, community } = await fixture();
    const cancelled = await seedTask(t.db, community.id, new Date(now.getTime() - HOUR));
    await end(community, cancelled.id, "cancelled", new Date(now.getTime() - MIN));
    const lapsed = await expired(community.id, now, 20 * MIN);
    await end(community, lapsed.id, "cancelled", new Date(now.getTime() - 5 * MIN));
    await expired(community.id, now, 61 * MIN);
    const brief = await expired(community.id, now, 10 * MIN);
    await t.db.update(tasks).set({ kind: "open" }).where(eq(tasks.id, brief.id));
    expect(await claimRaidRecap(t.db, WEB, now)).toBeUndefined();
  });

  it("sends nothing when the raid is cancelled between the claim and the send", async () => {
    const { now, community } = await fixture();
    const task = await expired(community.id, now, 10 * MIN);
    const claim = await claimRaidRecap(t.db, WEB, now);
    if (!claim) throw new Error("claim");
    expect((await end(community, task.id, "cancelled", now)).status).toBe("changed");
    const before = sends.length;
    expect(await deliverRaidRecap(t.db, claim, ok)).toBe("skipped");
    expect(sends.length).toBe(before);
    expect(await recapOf(task.id)).toMatchObject({ status: "skipped", reason: "raid_cancelled" });
    expect(await claimRaidRecap(t.db, WEB, new Date(now.getTime() + MIN))).toBeUndefined();
  });

  it("retries a rate-limited send after Telegram's delay and posts once", async () => {
    const { now, community } = await fixture();
    const task = await expired(community.id, now, MIN);
    const first = await claimRaidRecap(t.db, WEB, now);
    if (!first) throw new Error("claim");
    expect(
      await deliverRaidRecap(t.db, first, {
        ...failing(rateLimit({ retry_after: 30 })),
        clock: at(now),
      }),
    ).toBe("pending");
    const pending = await recapOf(task.id);
    expect(pending).toMatchObject({ status: "pending", retryUsed: false });
    expect(pending?.nextAttemptAt).toEqual(new Date(now.getTime() + 30_000));
    expect(await claimRaidRecap(t.db, WEB, now)).toBeUndefined();
    const retry = await claimRaidRecap(
      t.db,
      WEB,
      new Date((pending?.nextAttemptAt.getTime() ?? 0) + 1),
    );
    expect(retry?.taskId).toBe(task.id);
    if (!retry) throw new Error("retry");
    const before = sends.length;
    expect(await deliverRaidRecap(t.db, retry, ok)).toBe("sent");
    expect(sends.length - before).toBe(1);
    expect(await recapOf(task.id)).toMatchObject({ status: "sent", retryUsed: true });
  });

  it("ends the recap on a second rate limit; no later sweep sends a third request", async () => {
    const { now, community } = await fixture();
    const task = await expired(community.id, now, MIN);
    let requests = 0;
    const limited = (clockAt: Date) => ({
      clock: at(clockAt),
      send: async () => {
        requests += 1;
        throw rateLimit({ retry_after: 30 });
      },
    });
    const first = await claimRaidRecap(t.db, WEB, now);
    if (!first) throw new Error("claim");
    expect(await deliverRaidRecap(t.db, first, limited(now))).toBe("pending");
    const retryAt = new Date(now.getTime() + 30_000);
    const retry = await claimRaidRecap(t.db, WEB, retryAt);
    expect(retry?.taskId).toBe(task.id);
    if (!retry) throw new Error("retry");
    expect(await deliverRaidRecap(t.db, retry, limited(retryAt))).toBe("failed");
    expect(await recapOf(task.id)).toMatchObject({
      status: "failed",
      reason: "rate_limit_retry_exhausted",
      retryUsed: true,
    });
    for (const minutes of [1, 2, 10, 30, 58])
      expect(
        await claimRaidRecap(t.db, WEB, new Date(now.getTime() + minutes * MIN)),
      ).toBeUndefined();
    expect(requests).toBe(2);
  });

  it("waits 60 s when retry_after is missing or invalid", async () => {
    const { now, community } = await fixture();
    const raids = [
      await expired(community.id, now, 3 * MIN),
      await expired(community.id, now, 2 * MIN),
      await expired(community.id, now, MIN),
    ];
    for (const parameters of [undefined, { retry_after: 0 }, { retry_after: 2.5 }]) {
      const claim = await claimRaidRecap(t.db, WEB, now);
      if (!claim) throw new Error("claim");
      expect(
        await deliverRaidRecap(t.db, claim, { ...failing(rateLimit(parameters)), clock: at(now) }),
      ).toBe("pending");
    }
    for (const task of raids)
      expect((await recapOf(task.id))?.nextAttemptAt).toEqual(new Date(now.getTime() + 60_000));
  });

  it("keeps a retry that falls past the one-hour window pending and never sends it", async () => {
    const { now, community } = await fixture();
    const task = await expired(community.id, now, 59 * MIN);
    const first = await claimRaidRecap(t.db, WEB, now);
    if (!first) throw new Error("claim");
    expect(
      await deliverRaidRecap(t.db, first, {
        ...failing(rateLimit({ retry_after: 120 })),
        clock: at(now),
      }),
    ).toBe("pending");
    for (const minutes of [2, 3, 30])
      expect(
        await claimRaidRecap(t.db, WEB, new Date(now.getTime() + minutes * MIN)),
      ).toBeUndefined();
    expect(await recapOf(task.id)).toMatchObject({ status: "pending", retryUsed: false });
  });

  it("never resends a rejected or uncertain send", async () => {
    const { now, community } = await fixture();
    const rejected = await expired(community.id, now, 2 * MIN);
    const lost = await expired(community.id, now, MIN);
    const forbidden = new GrammyError(
      "Forbidden",
      { ok: false, error_code: 403, description: "Forbidden: bot was kicked" },
      "sendMessage",
      {},
    );
    const a = await claimRaidRecap(t.db, WEB, now);
    const b = await claimRaidRecap(t.db, WEB, now);
    expect([a?.taskId, b?.taskId]).toEqual([rejected.id, lost.id]);
    if (!a || !b) throw new Error("claims");
    expect(await deliverRaidRecap(t.db, a, failing(forbidden))).toBe("failed");
    expect(await deliverRaidRecap(t.db, b, failing(new Error("socket hang up")))).toBe("uncertain");
    expect(await claimRaidRecap(t.db, WEB, new Date(now.getTime() + 5 * MIN))).toBeUndefined();
    expect((await recapOf(lost.id))?.reason).toBe("send_unknown");
  });
});
