import { fileURLToPath } from "node:url";
import type { RewardPurpose } from "@hyphae/core";
import {
  createDb,
  members,
  rewardDecisions,
  rewardDispatches,
  rewardNominations,
  rewardSlots,
} from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withCommunityLock } from "./config.js";
import { appendCorrection } from "./decisions.js";
import { beginDispatch, runEvaluation } from "./evaluation.js";
import { admitContribution } from "./intake.js";
import { nominate } from "./slots.js";
import { later, seedRewardLane, T0 } from "./test-db.js";

// Two independent pools against a disposable Postgres 17 (scripts/test-pg.sh). Races are asserted
// on final rows, repeated, never on timing.
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const a = createDb(url);
const b = createDb(url);
const ROUNDS = 50;

beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([a.$client.end(), b.$client.end()]);
});

describe("community lock mode (review observation 1)", () => {
  it("does not block foreign-key inserts, and still excludes another reward writer", async () => {
    const { community } = await seedRewardLane(a);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = withCommunityLock(a, community.id, {}, async () => {
      locked();
      await held;
    });
    await lockTaken;

    try {
      const linked = await b.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '500ms'`);
        const [row] = await tx
          .insert(members)
          .values({
            communityId: community.id,
            telegramUserId: 777n,
            wallet: `Concurrent${community.id}`,
            linkMethod: "paste",
          })
          .returning({ id: members.id });
        return row;
      });
      expect(linked?.id).toBeDefined();

      const competing = b.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '500ms'`);
        return withCommunityLock(tx, community.id, {}, async () => "second writer");
      });
      const refused = await competing.then(
        () => null,
        (err: { cause?: { code?: string } }) => err,
      );
      expect(refused?.cause?.code).toBe("55P03"); // lock_not_available: the reward lock held
    } finally {
      release();
      await holder;
    }
  });
});

describe("races on one member's effort slot", () => {
  it(`two linked handles nominating at once get one reservation (${ROUNDS} rounds)`, async () => {
    for (let i = 0; i < ROUNDS; i += 1) {
      const lane = await seedRewardLane(a);
      const [x, y] = [await lane.admitOne(), await lane.admitOne()];
      const results = await Promise.all(
        [
          [a, x, "h1"],
          [b, y, "h2"],
        ].map(([db, intake, key]) =>
          nominate(
            db as typeof a,
            {
              communityId: lane.community.id,
              memberId: lane.member.id,
              contributionId: (intake as typeof x).contributionId,
              idempotencyKey: key as string,
            },
            { clock: later(90_000) },
          ),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual(["nominated", "slot_in_use"]);
      const slots = await a
        .select()
        .from(rewardSlots)
        .where(eq(rewardSlots.memberId, lane.member.id));
      expect(slots).toHaveLength(1);
      expect(slots[0]).toMatchObject({ state: "reserved", candidatesUsed: 1 });
    }
  });

  it(`two workers beginning one nomination create one dispatch (${ROUNDS} rounds)`, async () => {
    for (let i = 0; i < ROUNDS; i += 1) {
      const lane = await seedRewardLane(a);
      const intake = await lane.admitOne();
      const n = await nominate(
        a,
        {
          communityId: lane.community.id,
          memberId: lane.member.id,
          contributionId: intake.contributionId,
          idempotencyKey: "n1",
        },
        { clock: later(90_000) },
      );
      if (n.status !== "nominated") throw new Error(n.status);
      const begun = await Promise.all(
        [a, b].map((db) =>
          beginDispatch(
            db,
            {
              communityId: lane.community.id,
              target: { nominationId: n.nomination.id },
              model: "test:fake",
            },
            { clock: later(120_000) },
          ),
        ),
      );
      expect(begun.map((r) => r.status).sort()).toEqual(["begun", "exists"]);
      const dispatches = await a
        .select()
        .from(rewardDispatches)
        .where(eq(rewardDispatches.nominationId, n.nomination.id));
      expect(dispatches).toHaveLength(1);
      const [nomination] = await a
        .select()
        .from(rewardNominations)
        .where(eq(rewardNominations.id, n.nomination.id));
      expect(nomination?.state).toBe("evaluating");
    }
  });

  it(`a redelivered submission on two connections is admitted once (${ROUNDS} rounds)`, async () => {
    for (let i = 0; i < ROUNDS; i += 1) {
      const lane = await seedRewardLane(a);
      const input = {
        communityId: lane.community.id,
        memberId: lane.member.id,
        taskId: null,
        contribution: {
          kind: "post" as const,
          url: `https://x.com/a/status/9${i}`,
          text: "same message",
          oembed: null,
          telegramMessageId: 1,
        },
        artifactKey: `x:status:9${i}`,
        idempotencyKey: "tg:-1:1",
        capture: { source: "x_oembed" as const, capturedAt: T0.toISOString(), limitations: [] },
      };
      const results = await Promise.all(
        [a, b].map((db) => admitContribution(db, input, { clock: later(60_000) })),
      );
      const created = results.map((r) => (r.status === "admitted" ? r.created : null)).sort();
      expect(created).toEqual([false, true]);
    }
  });
});

describe("races on one decision lineage (O6)", () => {
  const decided = async () => {
    const lane = await seedRewardLane(a);
    const intake = await lane.admitOne();
    const result = await runEvaluation(
      a,
      { communityId: lane.community.id, target: { contributionId: intake.contributionId } },
      {
        model: "test:fake",
        horizonMs: 300_000,
        clock: later(120_000),
        call: async (_prompt: unknown, _purpose: RewardPurpose) => ({
          output: {
            score: 85,
            rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
            flags: [],
            aiSlop: { patterns: [], templateRhythm: false },
            reasoning: "Specific to the post and checked.",
          },
          latencyMs: 5,
          costMicroUsd: 100,
        }),
      },
    );
    if (result.status !== "completed") throw new Error(result.status);
    const correct = (db: typeof a, rawQuality: number, idempotencyKey: string) =>
      appendCorrection(
        db,
        {
          communityId: lane.community.id,
          contributionId: intake.contributionId,
          expectedRevision: 1,
          changes: { rawQuality },
          reason: "Operator review of the thread.",
          evidenceRefs: ["https://x.com/a/status/1"],
          actor: "script:reward-correct",
          idempotencyKey,
        },
        { clock: later(180_000) },
      );
    const lineage = () =>
      a
        .select()
        .from(rewardDecisions)
        .where(eq(rewardDecisions.contributionId, intake.contributionId));
    return { correct, lineage };
  };

  it(`two corrections of one revision yield one successor (${ROUNDS} rounds)`, async () => {
    for (let i = 0; i < ROUNDS; i += 1) {
      const { correct, lineage } = await decided();
      const results = await Promise.all([correct(a, 70, "op-a"), correct(b, 90, "op-b")]);
      expect(results.map((r) => r.status).sort()).toEqual(["appended", "stale_revision"]);
      const rows = await lineage();
      expect(rows.map((r) => r.revision).sort()).toEqual([1, 2]);
    }
  });

  it(`one correction retried on two connections is appended once (${ROUNDS} rounds)`, async () => {
    for (let i = 0; i < ROUNDS; i += 1) {
      const { correct, lineage } = await decided();
      const results = await Promise.all([correct(a, 70, "op"), correct(b, 70, "op")]);
      const created = results.map((r) => (r.status === "appended" ? r.created : null)).sort();
      expect(created).toEqual([false, true]);
      expect(await lineage()).toHaveLength(2);
    }
  });
});
