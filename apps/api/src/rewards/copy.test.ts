import type { RewardPurpose } from "@hyphae/core";
import { epochs, members, rewardDecisions } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildRewardConfigPayload } from "./config.js";
import { effectiveResults } from "./effective.js";
import { runEvaluation } from "./evaluation.js";
import { createTestDb, later, rubric, seedRewardLane } from "./test-db.js";

const MIN = 60_000;

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const ORIGINAL =
  "The snapshot closes at 00:00Z and holds are read inside the 24 h window after it, so a wallet that sells at 00:10Z can still pass.";
const COPY = ORIGINAL.replace("sells", "dumps");

const quality = (score: number) => ({
  score,
  rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "Specific to the post.",
});
const answer = (score: number) => async (_prompt: unknown, _purpose: RewardPurpose) => ({
  output: quality(score),
  latencyMs: 5,
  costMicroUsd: 100,
});

async function lane(copyRule = true) {
  const s = await seedRewardLane(t.db, buildRewardConfigPayload(rubric, { copy: copyRule }));
  const [epoch] = await t.db.select().from(epochs).where(eq(epochs.communityId, s.community.id));
  if (!epoch) throw new Error("no epoch");
  const [other] = await t.db
    .insert(members)
    .values({
      communityId: s.community.id,
      telegramUserId: 43n,
      wallet: "OtherWallet",
      linkMethod: "paste",
    })
    .returning();
  if (!other) throw new Error("no second member");
  const admit = (text: string, atMs: number, memberId = s.member.id) =>
    s.admitOne(undefined, memberId, later(atMs), text);
  const score = (contributionId: string, value: number, atMs: number) =>
    runEvaluation(
      t.db,
      { communityId: s.community.id, target: { contributionId } },
      { model: "test:fake", call: answer(value), horizonMs: 5 * MIN, clock: later(atMs) },
    );
  const read = () =>
    effectiveResults(
      t.db,
      { communityId: s.community.id, epochId: epoch.id },
      { clock: later(10 * MIN) },
    );
  const lineage = (contributionId: string) =>
    t.db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.contributionId, contributionId))
      .orderBy(asc(rewardDecisions.revision));
  return { ...s, other, admit, score, read, lineage };
}

describe("copy rule", () => {
  it("a post 95% the same as an earlier post that earned points scores zero, and says why", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);

    const [copy] = await l.lineage(second.contributionId);
    expect(copy).toMatchObject({ creditedQuality: 0, pointUnits: 0n, flags: ["spam"] });
    expect(copy?.explanation).toContain(first.contributionId);
    const r = await l.read();
    expect(r.entries.find((e) => e.contributionId === first.contributionId)?.pointUnits).toBe(
      "8500000000",
    );
    expect(r.entries.find((e) => e.contributionId === second.contributionId)?.pointUnits).toBe("0");
  });

  it("a reply on the same topic in other words is not a copy and earns normally", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(
      "Holds are read after the snapshot closes, which leaves a window where a wallet can sell and still count.",
      70_000,
      l.other.id,
    );
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 80, 3 * MIN);

    const r = await l.read();
    expect(r.entries.map((e) => e.pointUnits)).toEqual(["8500000000", "8000000000"]);
  });

  it("scored out of order: the original earns and the copy that earned first is zeroed by a correction", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(second.contributionId, 85, 2 * MIN);
    expect((await l.read()).entries.map((e) => e.pointUnits)).toEqual(["0", "8500000000"]);
    await l.score(first.contributionId, 85, 3 * MIN);

    const lineage = await l.lineage(second.contributionId);
    expect(lineage.map((d) => d.revision)).toEqual([1, 2]);
    expect(lineage[1]).toMatchObject({
      pointUnits: 0n,
      flags: ["spam"],
      correctionActor: "system:copy-rule",
    });
    expect(lineage[1]?.correctionEvidence).toEqual([`contribution:${first.contributionId}`]);
    const r = await l.read();
    expect(r.entries.find((e) => e.contributionId === first.contributionId)?.pointUnits).toBe(
      "8500000000",
    );
    expect(r.entries.find((e) => e.contributionId === second.contributionId)?.pointUnits).toBe("0");
    expect(r.totals.reduce((sum, m) => sum + BigInt(m.pointUnits), 0n)).toBe(8_500_000_000n);
  });

  it("a copy of a post that earned nothing is not a copy: it earns when it scores", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 40, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);

    const r = await l.read();
    expect(r.entries.map((e) => e.pointUnits)).toEqual(["0", "8500000000"]);
  });

  it("the same member copying their own earlier post is a copy too", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);

    expect((await l.read()).totals).toEqual([
      { memberId: l.member.id, pointUnits: "8500000000", wholePoints: "85" },
    ]);
  });

  it("an epoch whose pinned configuration has no copy rule scores copies as before", async () => {
    const l = await lane(false);
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);

    expect((await l.read()).entries.map((e) => e.pointUnits)).toEqual(["8500000000", "8500000000"]);
    expect(await l.lineage(second.contributionId)).toHaveLength(1);
  });
});
