import { randomInt, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  communities,
  contributions,
  createDb,
  members,
  raidSubmissionReceipts,
  raidSubmissionSessions,
  submissionIssues,
  tasks,
} from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbClock } from "../rewards/config.js";
import { rubric } from "../rewards/test-db.js";
import { reportSubmissionIssue } from "./receipts.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use the disposable test:pg runner");
const a = createDb(url);
const b = createDb(url);
beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([a.$client.end(), b.$client.end()]);
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("missing fixture");
  return value;
}

async function setup() {
  const community = required(
    (
      await a
        .insert(communities)
        .values({
          mint: `Receipts${randomUUID()}`,
          name: "Receipt race",
          telegramChatId: -BigInt(randomInt(1, 2 ** 47)),
          adminTelegramUserId: 7n,
          rubricVersion: rubric.version,
          rubric,
        })
        .returning()
    )[0],
  );
  const member = required(
    (
      await a
        .insert(members)
        .values({
          communityId: community.id,
          telegramUserId: 42n,
          wallet: randomUUID(),
          linkMethod: "paste",
        })
        .returning()
    )[0],
  );
  const task = required(
    (
      await a
        .insert(tasks)
        .values({
          communityId: community.id,
          kind: "raid",
          status: "closed",
          opensAt: new Date(0),
          closesAt: new Date(1),
        })
        .returning()
    )[0],
  );
  const contribution = required(
    (
      await a
        .insert(contributions)
        .values({
          communityId: community.id,
          memberId: member.id,
          taskId: task.id,
          kind: "reply",
          text: "Receipt concurrency fixture",
          telegramMessageId: 1,
        })
        .returning()
    )[0],
  );
  const session = required(
    (
      await a
        .insert(raidSubmissionSessions)
        .values({
          communityId: community.id,
          taskId: task.id,
          telegramUserId: 42n,
          kind: "reply",
          expiresAt: new Date(1),
        })
        .returning()
    )[0],
  );
  const receipt = required(
    (
      await a
        .insert(raidSubmissionReceipts)
        .values({
          sessionId: session.id,
          communityId: community.id,
          memberId: member.id,
          taskId: task.id,
          contributionId: contribution.id,
          artifactKey: `x:status:${randomUUID()}`,
        })
        .returning()
    )[0],
  );
  return { community, member, receipt };
}

function barrier() {
  let enter = () => {};
  let release = () => {};
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { enter, release, entered, wait };
}

async function receiptWriterIsWaiting() {
  for (let i = 0; i < 50; i++) {
    const result = await a.execute(sql`
      select count(*)::int as waiting from pg_stat_activity
      where pid <> pg_backend_pid() and wait_event_type = 'Lock'
        and query like '%raid_submission_receipts%'
    `);
    if (Number(result[0]?.waiting) > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

async function race(receiptId: string) {
  const gate = barrier();
  const input = {
    receiptId,
    telegramUserId: 42n,
    telegramMessageId: 100,
    text: "First simultaneous report",
  };
  const first = reportSubmissionIssue(a, input, {
    clock: async (tx, communityId) => {
      gate.enter();
      await gate.wait;
      return dbClock(tx, communityId);
    },
  });
  await gate.entered;
  const second = reportSubmissionIssue(b, {
    ...input,
    telegramMessageId: 101,
    text: "Second simultaneous report",
  });
  let waited: boolean;
  try {
    waited = await receiptWriterIsWaiting();
  } finally {
    gate.release();
  }
  const results = await Promise.all([first, second]);
  expect(waited).toBe(true);
  return results;
}

describe("bounded issue reports on two PostgreSQL pools", () => {
  it("serializes distinct first reports so only one is stored during the cooldown", async () => {
    const { receipt } = await setup();
    const results = await race(receipt.id);
    expect(results.map((r) => r.status).sort()).toEqual(["cooldown", "recorded"]);
    expect(
      await a.select().from(submissionIssues).where(eq(submissionIssues.receiptId, receipt.id)),
    ).toHaveLength(1);
    const replay = await reportSubmissionIssue(b, {
      receiptId: receipt.id,
      telegramUserId: 42n,
      telegramMessageId: 100,
      text: "A retry cannot replace its original text",
    });
    expect(replay).toEqual({ ...results[0], status: "duplicate" });
  });

  it("serializes the final slot without exceeding three reports and keeps retries available at the cap", async () => {
    const { receipt, community, member } = await setup();
    const now = await dbClock(a, community.id);
    await a.insert(submissionIssues).values(
      [1, 2].map((n) => ({
        receiptId: receipt.id,
        communityId: community.id,
        memberId: member.id,
        telegramMessageId: n,
        text: `Previous report ${n}`,
        createdAt: new Date(now.getTime() - (4 - n) * 60_000),
      })),
    );
    const results = await race(receipt.id);
    expect(results.map((r) => r.status).sort()).toEqual(["limit", "recorded"]);
    expect(
      await a.select().from(submissionIssues).where(eq(submissionIssues.receiptId, receipt.id)),
    ).toHaveLength(3);
    expect(
      await reportSubmissionIssue(b, {
        receiptId: receipt.id,
        telegramUserId: 42n,
        telegramMessageId: 100,
        text: "Retry",
      }),
    ).toEqual({ ...results[0], status: "duplicate" });
    expect(
      await reportSubmissionIssue(b, {
        receiptId: receipt.id,
        telegramUserId: 43n,
        telegramMessageId: 100,
        text: "Wrong caller",
      }),
    ).toEqual({ status: "not_found" });
  });

  it("does not take the community reward lock while holding the receipt lock", async () => {
    const { receipt, community } = await setup();
    const gate = barrier();
    const report = reportSubmissionIssue(
      a,
      {
        receiptId: receipt.id,
        telegramUserId: 42n,
        telegramMessageId: 1,
        text: "Preserve reward lock availability",
      },
      {
        clock: async (tx, communityId) => {
          gate.enter();
          await gate.wait;
          return dbClock(tx, communityId);
        },
      },
    );
    await gate.entered;
    try {
      await b.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`select id from communities where id = ${community.id} for no key update nowait`,
        );
        expect(rows).toHaveLength(1);
      });
    } finally {
      gate.release();
    }
    expect((await report).status).toBe("recorded");
  });
});
