import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promptTemplateHash, ReadApiV1 } from "@hyphae/core";
import { communities, createDb, members } from "@hyphae/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readContribution, readEpoch } from "../http/read-service.js";
import { epochCommitments } from "../payout/commitments.js";
import { type JevScorerDef, jevTemplateHash } from "../scoring/scorers.js";
import { amendEpochPrompt } from "./amendment.js";
import { bootstrapRewardEpochs, buildRewardConfigPayload } from "./config.js";
import { admitContribution } from "./intake.js";
import { later, rubric, T0 } from "./test-db.js";

// The amendment path through postgres-js, the production driver (scripts/test-pg.sh): typed
// timestamp comparisons, microsecond reads and the database's own non-retroactivity check.
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const db = createDb(url);
const HOUR = 3_600_000;

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await db.$client.end();
});

async function seed() {
  const [community] = await db
    .insert(communities)
    .values({
      mint: `AmendPg${randomUUID().slice(0, 8)}`,
      name: "Amendment pg",
      telegramChatId: -BigInt(`0x${randomBytes(6).toString("hex")}`) - 1n,
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("seed: community");
  const [member] = await db
    .insert(members)
    .values({
      communityId: community.id,
      telegramUserId: 42n,
      wallet: `W${randomUUID().slice(0, 8)}`,
      linkMethod: "paste",
    })
    .returning();
  if (!member) throw new Error("seed: member");
  await bootstrapRewardEpochs(
    db,
    {
      communityId: community.id,
      payload: {
        ...buildRewardConfigPayload(rubric),
        scoring: {
          promptVersion: "reward-eval/1",
          promptTemplateHash: promptTemplateHash("reward-eval/1") as string,
        },
      },
      opensAt: T0,
      proposedBy: "test",
    },
    { clock: later(-HOUR) },
  );
  let n = 0;
  const admitAt = async (ms: number) => {
    n += 1;
    const r = await admitContribution(
      db,
      {
        communityId: community.id,
        memberId: member.id,
        contribution: {
          kind: "reply",
          url: `https://x.com/a/status/pg${n}`,
          text: `reply ${n}`,
          oembed: null,
          telegramMessageId: n,
        },
        artifactKey: `x:status:pg${community.id}${n}`,
        idempotencyKey: `tg:pg:${community.id}:${n}`,
        capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: [] },
      },
      { clock: later(ms) },
    );
    if (r.status !== "admitted") throw new Error(r.status);
    return r.intake;
  };
  return { community, admitAt };
}

describe("a pilot amendment on postgres-js", () => {
  it("pins by effective_at, reads back in microseconds, and is committed per decision config", async () => {
    const s = await seed();
    const before = await s.admitAt(HOUR + 59 * 60_000);
    const row = await amendEpochPrompt(
      db,
      {
        communityId: s.community.id,
        epochIndex: 1,
        promptVersion: "reward-eval/2",
        effectiveAt: new Date(T0.getTime() + 2 * HOUR),
        actor: "Cisco (founder)",
        reason: "Pilot testing phase.",
      },
      { clock: later(HOUR + 59 * 60_000 + 30_000) },
    );
    const exactly = await s.admitAt(2 * HOUR);
    expect(before.configId).toBe(row.fromConfigId);
    expect(exactly.configId).toBe(row.toConfigId);

    const now = new Date(T0.getTime() + 3 * HOUR);
    const e = ReadApiV1.epoch.parse(await readEpoch(db, s.community.mint, 1, now));
    expect(e.amendments?.[0]).toMatchObject({
      effective_at: "2026-10-01T02:00:00.000000Z",
      recorded_at: "2026-10-01T01:59:30.000000Z",
    });
    const c = ReadApiV1.contribution.parse(await readContribution(db, exactly.contributionId, now));
    expect(c.amendment).toEqual({
      effective_at: "2026-10-01T02:00:00.000000Z",
      prompt_version: "reward-eval/2",
    });
    const commitments = await epochCommitments(db, row.epochId);
    expect(commitments.evidence.size).toBe(2);
  });

  it("the database refuses an amendment recorded at or after its effective time", async () => {
    const s = await seed();
    await expect(
      amendEpochPrompt(
        db,
        {
          communityId: s.community.id,
          epochIndex: 1,
          promptVersion: "reward-eval/2",
          effectiveAt: new Date(T0.getTime() + 2 * HOUR),
          actor: "Cisco (founder)",
          reason: "Pilot testing phase.",
        },
        { clock: later(2 * HOUR) },
      ),
    ).rejects.toThrow(/future/);
  });
});

describe("a second amendment on postgres-js", () => {
  const registry = new Map([
    [
      "reward-jev/1",
      {
        version: "reward-jev/1",
        effortVersion: "reward-eval/2",
        templateHash: jevTemplateHash("jev-1.13.0", { id: "pg" }),
        model: "typesafe:jev-1.13.0",
      } as JevScorerDef,
    ],
  ]);

  it("chains from the config in force, pins by the latest effective time, and reads back both", async () => {
    const s = await seed();
    const amend = (promptVersion: string, effectiveHours: number, clockMs: number) =>
      amendEpochPrompt(
        db,
        {
          communityId: s.community.id,
          epochIndex: 1,
          promptVersion,
          registry,
          effectiveAt: new Date(T0.getTime() + effectiveHours * HOUR),
          actor: "Cisco (founder)",
          reason: "Pilot testing phase.",
        },
        { clock: later(clockMs) },
      );
    const first = await amend("reward-eval/2", 2, HOUR);
    await expect(amend("reward-jev/1", 4, HOUR + 30_000)).rejects.toThrow(/not yet in effect/);
    const second = await amend("reward-jev/1", 4, 2 * HOUR + 10 * 60_000);
    expect(second.fromConfigId).toBe(first.toConfigId);

    const between = await s.admitAt(3 * HOUR);
    const after = await s.admitAt(4 * HOUR);
    expect(between.configId).toBe(first.toConfigId);
    expect(after.configId).toBe(second.toConfigId);

    const now = new Date(T0.getTime() + 5 * HOUR);
    const e = ReadApiV1.epoch.parse(await readEpoch(db, s.community.mint, 1, now));
    expect(e.amendments?.map((a) => a.to.prompt_version)).toEqual([
      "reward-eval/2",
      "reward-jev/1",
    ]);
    const c = ReadApiV1.contribution.parse(await readContribution(db, after.contributionId, now));
    expect(c.amendment).toEqual({
      effective_at: "2026-10-01T04:00:00.000000Z",
      prompt_version: "reward-jev/1",
    });
    // The way back to the first amendment's prompt: a contribution admitted after it reads that
    // amendment's time, not the earlier amendment that pinned the same config.
    await amend("reward-eval/2", 6, 4 * HOUR + 10 * 60_000);
    const returned = await s.admitAt(6 * HOUR);
    const later6 = new Date(T0.getTime() + 7 * HOUR);
    const back = ReadApiV1.contribution.parse(
      await readContribution(db, returned.contributionId, later6),
    );
    expect(back.amendment).toEqual({
      effective_at: "2026-10-01T06:00:00.000000Z",
      prompt_version: "reward-eval/2",
    });
    await expect(amend("reward-eval/1", 8, 6 * HOUR + 10 * 60_000)).rejects.toThrow(/already used/);
  });
});
