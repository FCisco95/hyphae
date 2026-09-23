import { contributions } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setRewardIntakePaused } from "./config.js";
import type { AdmitInput } from "./intake.js";
import { admittedIntake, routeSubmission, submitEffort } from "./submission.js";
import { createTestDb, later, seedCommunity, seedRewardLane, T0 } from "./test-db.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const input = (communityId: string, memberId: string, n: number): AdmitInput => ({
  communityId,
  memberId,
  taskId: null,
  contribution: {
    kind: "post",
    url: "https://x.com/a/status/777",
    text: "my test run",
    oembed: null,
    telegramMessageId: n,
  },
  artifactKey: "x:status:777",
  idempotencyKey: `tg:-1:${n}`,
  capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: ["text_only"] },
});

describe("routeSubmission", () => {
  it("leaves a community without reward epochs on the legacy path, writing nothing", async () => {
    const { community, member } = await seedCommunity(t.db);
    expect(await routeSubmission(t.db, input(community.id, member.id, 1))).toEqual({
      lane: "legacy",
    });
    const rows = await t.db
      .select()
      .from(contributions)
      .where(eq(contributions.communityId, community.id));
    expect(rows).toHaveLength(0);
  });

  it("admits through the reward lane once the community is bootstrapped", async () => {
    const { community, member } = await seedRewardLane(t.db);
    const routed = await routeSubmission(t.db, input(community.id, member.id, 1), {
      clock: later(60_000),
    });
    expect(routed).toMatchObject({ lane: "reward", result: { status: "admitted", created: true } });
  });
});

describe("submitEffort", () => {
  it("admits and nominates new work in one command", async () => {
    const { community, member } = await seedRewardLane(t.db);
    const result = await submitEffort(
      t.db,
      { admit: input(community.id, member.id, 1), nominationKey: "tg:-1:1:effort" },
      { clock: later(60_000) },
    );
    expect(result).toMatchObject({
      admit: { status: "admitted" },
      nominate: { status: "nominated", nomination: { kind: "new_work" } },
    });
  });

  it("nominates the existing record when the artifact was already submitted", async () => {
    const { community, member } = await seedRewardLane(t.db);
    await routeSubmission(t.db, input(community.id, member.id, 1), { clock: later(60_000) });
    const result = await submitEffort(
      t.db,
      { admit: input(community.id, member.id, 2), nominationKey: "tg:-1:2:effort" },
      { clock: later(120_000) },
    );
    expect(result).toMatchObject({
      admit: { status: "duplicate_artifact" },
      nominate: { status: "nominated" },
    });
  });

  it("does not nominate while intake is paused", async () => {
    const { community, member } = await seedRewardLane(t.db);
    await setRewardIntakePaused(
      t.db,
      { communityId: community.id, paused: true },
      { clock: later(0) },
    );
    const result = await submitEffort(
      t.db,
      { admit: input(community.id, member.id, 1), nominationKey: "tg:-1:1:effort" },
      { clock: later(60_000) },
    );
    expect(result).toEqual({ admit: { status: "paused" } });
  });
});

describe("admittedIntake", () => {
  it("finds an admitted artifact by its canonical key in this community only", async () => {
    const { community, member } = await seedRewardLane(t.db);
    const other = await seedRewardLane(t.db);
    await routeSubmission(t.db, input(community.id, member.id, 1), { clock: later(60_000) });
    expect(await admittedIntake(t.db, community.id, "x:status:777")).toMatchObject({
      memberId: member.id,
    });
    expect(await admittedIntake(t.db, other.community.id, "x:status:777")).toBeUndefined();
  });
});
