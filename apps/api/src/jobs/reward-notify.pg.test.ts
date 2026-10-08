import { fileURLToPath } from "node:url";
import { communities, createDb } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fakeModel } from "../http/demo-seed.js";
import { runEvaluation } from "../rewards/evaluation.js";
import { later, seedRewardLane, T0 } from "../rewards/test-db.js";

// Two score messages of one member in one epoch, sent by two jobs at once (scripts/test-pg.sh).
const m = vi.hoisted(() => {
  const server = process.env.HYPHAE_TEST_PG_URL;
  if (!server) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
  // A database of its own: seedRewardLane's community mints repeat in every file.
  const name = "hyphae_notify_race";
  return {
    server,
    name,
    url: server.replace(/\/[^/]*$/, `/${name}`),
    sent: [] as string[],
    // Each send waits here until the test releases it.
    release: undefined as (() => void) | undefined,
    gate: Promise.resolve(),
    waiting: 0,
  };
});

vi.mock("../env.js", () => ({ env: { PUBLIC_WEB_URL: "https://hyphae.test" } }));
vi.mock("../scoring/default-model.js", () => ({ defaultModel: { id: "test" } }));
vi.mock("./queue.js", () => ({ QUEUES: {}, boss: {} }));
vi.mock("../db.js", async () => {
  const { createDb: create } = await import("@hyphae/db");
  return { db: create(m.url) };
});
vi.mock("../bot/index.js", () => ({
  bot: {
    token: "1:t",
    isInited: () => true,
    botInfo: { username: "t_bot" },
    api: {
      sendMessage: async (_chat: number, text: string) => {
        m.waiting += 1;
        await m.gate;
        m.sent.push(text);
      },
    },
  },
}));

const { db } = await import("../db.js");
const { notifyReward } = await import("./reward-jobs.js");
const observer = createDb(m.url);

beforeAll(async () => {
  const admin = createDb(m.server);
  await admin.execute(sql.raw(`drop database if exists ${m.name}`));
  await admin.execute(sql.raw(`create database ${m.name}`));
  await admin.$client.end();
  await migrate(observer, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await observer.$client.end();
  await (db as unknown as typeof observer).$client.end();
});

const MIN = 60_000;
const HINT =
  "Not payable yet: link a wallet by signing and pass the rules test before the epoch closes.";

// Sessions blocked on an advisory lock, seen from another connection.
const lockWaiters = async () => {
  const rows = (await observer.execute(
    sql`select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and wait_event = 'advisory'`,
  )) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
};

describe("notifyReward, two jobs of one member at once", () => {
  it("puts the payout hint on exactly one of the two messages", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(T0.getTime() + 10 * MIN));
    const lane = await seedRewardLane(db);
    await db
      .update(communities)
      .set({ firstPaidEpoch: 1 })
      .where(eq(communities.id, lane.community.id));
    const jobs = [];
    for (const n of [1, 2]) {
      const intake = await lane.admitOne();
      const r = await runEvaluation(
        db,
        { communityId: lane.community.id, target: { contributionId: intake.contributionId } },
        { model: "test:fake", call: fakeModel(85), horizonMs: 5 * MIN, clock: later(2 * MIN) },
      );
      if (r.status !== "completed") throw new Error(`score: ${r.status}`);
      jobs.push({
        communityId: lane.community.id,
        contributionId: intake.contributionId,
        decisionId: r.decision.id,
        text: `scored ${n}`,
      });
    }

    m.gate = new Promise((resolve) => {
      m.release = resolve;
    });
    const running = jobs.map((job) => notifyReward(job));
    // Both jobs have read: each is either holding its send at the gate or waiting for the lock.
    const until = performance.now() + 20_000;
    while (!(m.waiting === 2 || (m.waiting === 1 && (await lockWaiters()) === 1))) {
      if (performance.now() > until) throw new Error("the jobs never reached their sends");
      await new Promise((r) => setImmediate(r));
    }
    m.release?.();
    await Promise.all(running);
    vi.useRealTimers();

    expect(m.sent).toHaveLength(2);
    expect(m.sent.filter((t) => t.endsWith(HINT))).toHaveLength(1);
  });
});
