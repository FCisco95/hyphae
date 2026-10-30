import type { RewardPurpose } from "@hyphae/core";
import { epochs, members, rewardDecisions, rewardDispatches, rewardIntakes } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeEpoch } from "./close.js";
import { buildRewardConfigPayload, findOrInsertConfig } from "./config.js";
import { openCopyEpochs, reconcileCopies, reconcileEpoch } from "./copy.js";
import { appendCorrection, COPY_ACTOR } from "./decisions.js";
import { effectiveResults } from "./effective.js";
import { completeDispatch, runEvaluation } from "./evaluation.js";
import { decisionSuperseded, strandedWork } from "./recovery.js";
import { nominate } from "./slots.js";
import { createTestDb, later, rubric, seedRewardLane, T0 } from "./test-db.js";

const MIN = 60_000;
const WEEK_MS = 7 * 86_400_000; // epoch 1 is [T0, T0 + WEEK_MS)

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
const effort = {
  originalSubstance: { met: true, note: "own test" },
  inspectableWork: { met: true, note: "steps and output" },
  communityContribution: { met: true, note: "useful to holders" },
  missingEssentialEvidence: null,
  explanation: "You ran the flow and posted the result.",
};
const answer = (score: number) => async (_prompt: unknown, purpose: RewardPurpose) => ({
  output:
    purpose === "effort"
      ? { effort }
      : purpose === "quality_effort"
        ? { ...quality(score), effort }
        : quality(score),
  latencyMs: 5,
  costMicroUsd: 100,
});

const dropEvery = (text: string, step: number, offset: number) =>
  [...text].filter((_, i) => i % step !== offset).join("");

const POINTS = (whole: number) => (BigInt(whole) * 100_000_000n).toString();

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
  const read = (epochId = epoch.id, atMs = 10 * MIN) =>
    effectiveResults(t.db, { communityId: s.community.id, epochId }, { clock: later(atMs) });
  const points = async () => (await read()).entries.map((e) => e.pointUnits);
  const lineage = (contributionId: string) =>
    t.db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.contributionId, contributionId))
      .orderBy(asc(rewardDecisions.revision));
  const correct = (
    contributionId: string,
    expectedRevision: number,
    changes: { rawQuality: number },
    atMs: number,
  ) =>
    appendCorrection(
      t.db,
      {
        communityId: s.community.id,
        contributionId,
        expectedRevision,
        changes,
        reason: "reviewed by the admin",
        evidenceRefs: ["review"],
        actor: "admin:test",
        idempotencyKey: `k-${contributionId}-${expectedRevision}`,
      },
      { clock: later(atMs) },
    );
  return { ...s, epoch, other, admit, score, read, points, lineage, correct };
}

describe("copy rule", () => {
  it("a post 95% the same as an earlier post that earned points scores zero, and says why", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    const scored = await l.score(second.contributionId, 85, 3 * MIN);

    const lineage = await l.lineage(second.contributionId);
    expect(lineage.map((d) => d.revision)).toEqual([1, 2]);
    expect(lineage[1]).toMatchObject({
      creditedQuality: 0,
      pointUnits: 0n,
      flags: ["spam"],
      correctionActor: COPY_ACTOR,
    });
    expect(lineage[1]?.explanation).toContain("Only the first earns");
    expect(lineage[1]?.correctionEvidence).toEqual([`contribution:${first.contributionId}`]);
    // The member's message reports the zero, not the 85 the model first gave.
    expect(scored).toMatchObject({ status: "completed", decision: { pointUnits: 0n } });
    expect(await l.points()).toEqual([POINTS(85), "0"]);
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

    expect(await l.points()).toEqual([POINTS(85), POINTS(80)]);
  });

  it("unrelated Chinese sentences keep their points and receive no copy overlay", async () => {
    const l = await lane();
    const first = await l.admit("我们将在周末发布产品。欢迎测试！", 60_000);
    const second = await l.admit("明天社区讨论治理。请来投票！", 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), POINTS(85)]);
    expect(await l.lineage(second.contributionId)).toHaveLength(1);
  });

  it("an invalid contextual hostname remains new text, not an ignored link", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(`${ORIGINAL} a‌b.com/path`, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), POINTS(85)]);
  });

  it("a valid contextual middle dot does not make a duplicate earn points", async () => {
    const l = await lane();
    const base = "The snapshot closes at midnight.";
    const first = await l.admit(base, 60_000);
    const second = await l.admit(`${base} l·l.cat/path`, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), "0"]);
  });

  it.each(["example.co\u00adm/path", `example.${"\u00ad".repeat(100)}com/path`])(
    "an ignorable in the final hostname label does not make a duplicate earn: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight.";
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), "0"]);
    },
  );

  it("an invalid final hostname label is preserved without a false copy penalty", async () => {
    const l = await lane();
    const base = "The snapshot closes at midnight. ".repeat(5).trim();
    const first = await l.admit(base, 60_000);
    const second = await l.admit(`${base} example.co\u200cm/path`, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), POINTS(85)]);
    expect(await l.lineage(second.contributionId)).toHaveLength(1);
  });

  it.each(["example.%63om/path", "exa%6dple.com/path", "example%2ecom/path"])(
    "a percent-encoded hostname does not make a duplicate earn points: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight.";
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), "0"]);
    },
  );

  it("an invalid encoded hostname is not partially removed or falsely zeroed", async () => {
    const l = await lane();
    const base = "The snapshot closes at midnight. ".repeat(6).trim();
    const first = await l.admit(base, 60_000);
    const second = await l.admit(`${base} example.co%00m/path`, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), POINTS(85)]);
    expect(await l.lineage(second.contributionId)).toHaveLength(1);
  });

  it.each(["sub%2eexample.com/path", "sub%ef%bc%8eexample.com/path"])(
    "mixed hostname separators do not make a duplicate earn: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight.";
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), "0"]);
    },
  );

  it.each(["example%2ecom.%00/path", "example%2ecom.%zz/path"])(
    "mixed invalid encoded hostname is preserved without false spam: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight. ".repeat(6).trim();
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), POINTS(85)]);
      expect(await l.lineage(second.contributionId)).toHaveLength(1);
    },
  );

  it("an empty port does not make a duplicate earn points", async () => {
    const l = await lane();
    const base = "The snapshot closes at midnight.";
    const first = await l.admit(base, 60_000);
    const second = await l.admit(`${base} example.com:/x`, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), "0"]);
  });

  it.each(["example.com:abc/x", "example.com:80oops/x"])(
    "an invalid port is preserved without a false copy penalty: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight. ".repeat(6).trim();
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), POINTS(85)]);
      expect(await l.lineage(second.contributionId)).toHaveLength(1);
    },
  );

  it("a scheme-less link with a port does not make a duplicate earn points", async () => {
    const l = await lane();
    const base = "The snapshot closes at midnight.";
    const first = await l.admit(base, 60_000);
    const second = await l.admit(`${base} example.com:8080/some/path?x=1#d`, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), "0"]);
  });

  it.each(["192.0.2.1:8080/path?x=1#d", "[2001:db8::1]:8080/path?x=1#d"])(
    "a scheme-less IP link does not make a duplicate earn points: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight.";
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), "0"]);
    },
  );

  it.each(["192.0.2.1./path", "192。0。2。1/path"])(
    "an IPv4 separator variant does not make a duplicate earn points: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight.";
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), "0"]);
    },
  );

  it.each(["bücher.de/path", "例子.公司/path"])(
    "an internationalized domain link does not make a duplicate earn points: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight.";
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), "0"]);
    },
  );

  it("a Unicode domain separator does not make a duplicate earn points", async () => {
    const l = await lane();
    const base = "The snapshot closes at midnight.";
    const first = await l.admit(base, 60_000);
    const second = await l.admit(`${base} 例子。公司/path`, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), "0"]);
  });

  it.each(["example.com./path", "example.com.:8080/some/path?x=1#d"])(
    "a terminal hostname dot does not make a duplicate earn points: %s",
    async (link) => {
      const l = await lane();
      const base = "The snapshot closes at midnight.";
      const first = await l.admit(base, 60_000);
      const second = await l.admit(`${base} ${link}`, 70_000, l.other.id);
      await l.score(first.contributionId, 85, 2 * MIN);
      await l.score(second.contributionId, 85, 3 * MIN);
      expect(await l.points()).toEqual([POINTS(85), "0"]);
    },
  );

  it("scored out of order: the original earns and the copy that earned first is zeroed", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(second.contributionId, 85, 2 * MIN);
    expect(await l.points()).toEqual(["0", POINTS(85)]);
    await l.score(first.contributionId, 85, 3 * MIN);

    const lineage = await l.lineage(second.contributionId);
    expect(lineage.map((d) => d.revision)).toEqual([1, 2]);
    expect(lineage[1]).toMatchObject({
      pointUnits: 0n,
      flags: ["spam"],
      correctionActor: COPY_ACTOR,
    });
    expect(lineage[1]?.correctionEvidence).toEqual([`contribution:${first.contributionId}`]);
    expect(await l.points()).toEqual([POINTS(85), "0"]);
  });

  it("a copy of a post that earned nothing is not a copy: it earns when it scores", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 40, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);

    expect(await l.points()).toEqual(["0", POINTS(85)]);
  });

  it("the same member copying their own earlier post is a copy too", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);

    expect((await l.read()).totals).toEqual([
      { memberId: l.member.id, pointUnits: POINTS(85), wholePoints: "85" },
    ]);
  });

  it("an epoch whose pinned configuration has no copy rule scores copies as before", async () => {
    const l = await lane(false);
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);

    expect(await l.points()).toEqual([POINTS(85), POINTS(85)]);
    expect(await l.lineage(second.contributionId)).toHaveLength(1);
  });

  it("gives the same points in every scoring order, also when copies chain below the threshold", async () => {
    // A and B are copies, B and C are copies, A and C are not (10% apart). The sequential result
    // is A earns, B is zeroed, C earns: C is compared with the posts that earn, and B does not.
    const texts = [
      "a".repeat(100),
      `${"b".repeat(5)}${"a".repeat(95)}`,
      `${"b".repeat(10)}${"a".repeat(90)}`,
    ];
    const orders = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    for (const order of orders) {
      const l = await lane();
      const posts = [];
      for (const [i, text] of texts.entries()) {
        posts.push(await l.admit(text, 60_000 + i * 1_000, l.other.id));
      }
      for (const [step, index] of order.entries()) {
        const post = posts[index];
        if (!post) throw new Error("no post");
        await l.score(post.contributionId, 85, 2 * MIN + step * 1_000);
      }
      expect(await l.points(), `scored in order ${order.join("")}`).toEqual([
        POINTS(85),
        "0",
        POINTS(85),
      ]);
    }
  });

  it("an admin correction that lifts an original above zero zeroes the copy that earned", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 40, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual(["0", POINTS(85)]);

    await l.correct(first.contributionId, 1, { rawQuality: 85 }, 4 * MIN);
    expect(await l.points()).toEqual([POINTS(85), "0"]);
  });

  it("an admin correction that drops an original to zero gives its copy the points back", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    expect(await l.points()).toEqual([POINTS(85), "0"]);

    await l.correct(first.contributionId, 1, { rawQuality: 40 }, 4 * MIN);
    expect(await l.points()).toEqual(["0", POINTS(85)]);
    const lineage = await l.lineage(second.contributionId);
    expect(lineage.at(-1)).toMatchObject({ correctionActor: COPY_ACTOR, flags: [] });
  });

  it("a correction on a zeroed copy keeps its own quality for when the zero is lifted", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);

    await l.correct(second.contributionId, 2, { rawQuality: 90 }, 4 * MIN);
    expect(await l.points()).toEqual([POINTS(85), "0"]);
    await l.correct(first.contributionId, 1, { rawQuality: 40 }, 5 * MIN);
    expect(await l.points()).toEqual(["0", POINTS(90)]);
  });

  it("a re-entry that copies an earlier post of the epoch is a copy too", async () => {
    const l = await lane();
    const original = await l.admit("first try, since expired", 3 * MIN);
    const nominated = await nominate(
      t.db,
      {
        communityId: l.community.id,
        memberId: l.member.id,
        contributionId: original.contributionId,
        idempotencyKey: "n1",
      },
      { clock: later(3 * MIN) },
    );
    if (nominated.status !== "nominated") throw new Error(nominated.status);
    await closeEpoch(
      t.db,
      { communityId: l.community.id, epochId: l.epoch.id },
      { clock: later(WEEK_MS) },
    );

    const inEpoch2 = WEEK_MS + 10 * MIN;
    const post = await l.admit(ORIGINAL, inEpoch2);
    await l.score(post.contributionId, 85, inEpoch2 + MIN);
    const again = await nominate(
      t.db,
      {
        communityId: l.community.id,
        memberId: l.member.id,
        contributionId: original.contributionId,
        idempotencyKey: "n2",
        evidence: {
          contribution: {
            url: "https://x.com/a/status/now",
            text: COPY,
            oembed: null,
            telegramMessageId: 42,
          },
          capture: {
            source: "x_oembed",
            capturedAt: new Date(WEEK_MS).toISOString(),
            limitations: [],
          },
        },
      },
      { clock: later(inEpoch2 + 2 * MIN) },
    );
    if (again.status !== "nominated") throw new Error(again.status);
    const [reentry] = await t.db
      .select()
      .from(rewardIntakes)
      .where(eq(rewardIntakes.contributionId, again.nomination.contributionId));
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { nominationId: again.nomination.id } },
      {
        model: "test:fake",
        call: answer(85),
        horizonMs: 5 * MIN,
        clock: later(inEpoch2 + 3 * MIN),
      },
    );

    const r = await l.read(reentry?.epochId, inEpoch2 + 4 * MIN);
    const pointsOf = (id?: string) => r.entries.find((e) => e.contributionId === id)?.pointUnits;
    expect(pointsOf(post.contributionId)).toBe(POINTS(85));
    expect(pointsOf(reentry?.contributionId)).toBe("0");
  });
  it.each([5 * MIN, WEEK_MS - 16 * MIN, WEEK_MS - MIN])(
    "one run settles every post at %i ms, regardless of elapsed comparison time",
    async (atMs) => {
      const l = await lane(false);
      const base = `always complete ${atMs} ${ORIGINAL} ${ORIGINAL}`;
      // Removing characters changes the length, so only the edit distance can tell these apart.
      const texts = [base, dropEvery(base, 40, 3), dropEvery(base, 45, 7)];
      const posts = [];
      for (const [i, text] of texts.entries()) {
        posts.push(await l.admit(text, 60_000 + i * 1_000, l.other.id));
      }
      for (const [i, post] of posts.entries())
        await l.score(post.contributionId, 85, 2 * MIN + i * 1_000);
      expect(await l.points()).toEqual([POINTS(85), POINTS(85), POINTS(85)]);
      const pinned = await t.db.transaction((tx) =>
        findOrInsertConfig(tx, l.community.id, buildRewardConfigPayload(rubric, { copy: true })),
      );
      await t.db.update(epochs).set({ rewardConfigId: pinned.id }).where(eq(epochs.id, l.epoch.id));

      let elapsed = 0;
      const clock = vi.spyOn(Date, "now").mockImplementation(() => (elapsed += 3_000));
      try {
        await t.db.transaction((tx) =>
          reconcileCopies(tx, new Date(T0.getTime() + atMs), l.community.id, l.epoch.id),
        );
      } finally {
        clock.mockRestore();
      }
      expect(await l.points()).toEqual([POINTS(85), "0", "0"]);
      await t.db.transaction((tx) =>
        reconcileCopies(tx, new Date(T0.getTime() + atMs), l.community.id, l.epoch.id),
      );
      expect(await l.points()).toEqual([POINTS(85), "0", "0"]);
      expect(await l.lineage(posts[1]?.contributionId as string)).toHaveLength(2);
      expect(await l.lineage(posts[2]?.contributionId as string)).toHaveLength(2);
    },
  );

  it("one run settles out-of-order scoring before the final window and close freezes it", async () => {
    const l = await lane(false);
    const base = `before cutoff ${ORIGINAL} ${ORIGINAL}`;
    const texts = [base, dropEvery(base, 40, 3), dropEvery(base, 45, 7)];
    const posts = [];
    for (const [i, text] of texts.entries()) {
      posts.push(await l.admit(text, 60_000 + i * 1_000, l.other.id));
    }
    // Scored in the order that leaves the last copy paid until the whole epoch is compared.
    for (const [step, index] of [2, 1, 0].entries()) {
      const post = posts[index];
      if (!post) throw new Error("no post");
      await l.score(post.contributionId, 85, 2 * MIN + step * 1_000);
    }
    const pinned = await t.db.transaction((tx) =>
      findOrInsertConfig(tx, l.community.id, buildRewardConfigPayload(rubric, { copy: true })),
    );
    await t.db.update(epochs).set({ rewardConfigId: pinned.id }).where(eq(epochs.id, l.epoch.id));

    await t.db.transaction((tx) =>
      reconcileCopies(tx, new Date(T0.getTime() + WEEK_MS - 16 * MIN), l.community.id, l.epoch.id),
    );
    expect(await l.points()).toEqual([POINTS(85), "0", "0"]);
    await closeEpoch(
      t.db,
      { communityId: l.community.id, epochId: l.epoch.id },
      { clock: later(WEEK_MS) },
    );
    const closed = await l.read(l.epoch.id, WEEK_MS + MIN);
    expect(closed.entries.map((entry) => entry.pointUnits)).toEqual([POINTS(85), "0", "0"]);
  });

  it("many unrelated posts followed by an exact copy of the first: one run settles the copy", async () => {
    const l = await lane(false);
    const nonce = Math.random().toString(36).slice(2);
    const posts = [];
    for (let i = 0; i < 40; i++) {
      const text = `${nonce} post ${i}: ${"qwertyuiop".repeat((i % 7) + 1)} ${i * 7919}`;
      posts.push(await l.admit(text, 60_000 + i * 100, l.other.id));
    }
    posts.push(await l.admit(`${nonce} post 0: ${"qwertyuiop".repeat(1)} 0`, 70_000, l.other.id));
    for (const [i, post] of posts.entries()) {
      await l.score(post.contributionId, 85, 2 * MIN + i * 100);
    }
    const pinned = await t.db.transaction((tx) =>
      findOrInsertConfig(tx, l.community.id, buildRewardConfigPayload(rubric, { copy: true })),
    );
    await t.db.update(epochs).set({ rewardConfigId: pinned.id }).where(eq(epochs.id, l.epoch.id));

    await t.db.transaction((tx) =>
      reconcileCopies(tx, new Date(T0.getTime() + 5 * MIN), l.community.id, l.epoch.id),
    );
    const points = await l.points();
    expect(points.at(-1)).toBe("0");
    expect(points.slice(0, -1).every((p) => p === POINTS(85))).toBe(true);
  }, 30_000);

  it("the recovery sweep finds the epochs whose pinned configuration carries the rule", async () => {
    const withRule = await lane(true);
    const without = await lane(false);
    const found = await openCopyEpochs(t.db, new Date(T0.getTime() + MIN));
    expect(found.map((e) => e.communityId)).toContain(withRule.community.id);
    expect(found.map((e) => e.communityId)).not.toContain(without.community.id);
  });

  it("tells the member of a copy that earned first, once its original is scored", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(second.contributionId, 85, 2 * MIN);
    await l.score(first.contributionId, 85, 3 * MIN);

    const [firstDecision, overlay] = await l.lineage(second.contributionId);
    expect(await decisionSuperseded(t.db, firstDecision?.id as string)).toBe(true);
    expect(await decisionSuperseded(t.db, overlay?.id as string)).toBe(false);
    const work = await strandedWork(t.db, {
      now: new Date(T0.getTime() + 20 * MIN),
      graceMs: 60_000,
    });
    const mine = work.notifications.filter((n) => n.contributionId === second.contributionId);
    expect(mine.map((n) => n.decision.id)).toEqual([overlay?.id]);
    expect(mine[0]?.decision).toMatchObject({ pointUnits: 0n, correctionActor: COPY_ACTOR });
  });

  it("a replay of the completed dispatch reports the settled decision, not the one before the rule", async () => {
    const l = await lane();
    const first = await l.admit(ORIGINAL, 60_000);
    const second = await l.admit(COPY, 70_000, l.other.id);
    await l.score(first.contributionId, 85, 2 * MIN);
    await l.score(second.contributionId, 85, 3 * MIN);
    const [firstDecision] = await l.lineage(second.contributionId);
    const [dispatch] = await t.db
      .select()
      .from(rewardDispatches)
      .where(eq(rewardDispatches.id, firstDecision?.dispatchId as string));

    const replay = await completeDispatch(
      t.db,
      {
        communityId: l.community.id,
        dispatchId: dispatch?.id as string,
        fence: dispatch?.fence as number,
        output: quality(85),
        latencyMs: 5,
        costMicroUsd: 100,
      },
      { clock: later(5 * MIN) },
    );
    expect(replay).toMatchObject({
      status: "completed",
      created: false,
      decision: { pointUnits: 0n },
    });
  });
  it("reconciles encoded invalid hostnames quickly even when a repeated run has no writes", async () => {
    const l = await lane(false);
    const text = `${"a%2e".repeat(6_000)}.%00/path`;
    const posts = [];
    for (let i = 0; i < 12; i++) {
      posts.push(await l.admit(text, 60_000 + i * 100, l.other.id));
    }
    for (const [i, post] of posts.entries()) {
      await l.score(post.contributionId, 85, 2 * MIN + i * 100);
    }
    const pinned = await t.db.transaction((tx) =>
      findOrInsertConfig(tx, l.community.id, buildRewardConfigPayload(rubric, { copy: true })),
    );
    await t.db.update(epochs).set({ rewardConfigId: pinned.id }).where(eq(epochs.id, l.epoch.id));
    for (let i = 0; i < 2; i++) {
      const started = performance.now();
      await reconcileEpoch(
        t.db,
        { communityId: l.community.id, epochId: l.epoch.id },
        { clock: later(5 * MIN) },
      );
      expect(performance.now() - started).toBeLessThan(1_500);
      expect(await l.points()).toEqual([POINTS(85), ...Array(11).fill("0")]);
    }
  }, 30_000);

  it("settles 200 long near-copies and an exact copy completely in one fast run", async () => {
    const l = await lane(false);
    const base = "the snapshot closes at midnight and holds are read after it. ".repeat(425).trim();
    const posts = [await l.admit(base, 60_000)];
    for (let k = 0; k < 200; k++) {
      // Insertions/deletions above the cap do not trigger the copy rule.
      const variant = [...base].filter((_, i) => i % 101 !== 0 || i / 101 > k).join("");
      posts.push(await l.admit(variant, 60_001 + k * 100, l.other.id));
    }
    posts.push(await l.admit(base, 90_000, l.other.id));
    for (const [i, post] of posts.entries())
      await l.score(post.contributionId, 85, 2 * MIN + i * 1_000);
    const pinned = await t.db.transaction((tx) =>
      findOrInsertConfig(tx, l.community.id, buildRewardConfigPayload(rubric, { copy: true })),
    );
    await t.db.update(epochs).set({ rewardConfigId: pinned.id }).where(eq(epochs.id, l.epoch.id));

    const started = performance.now();
    await t.db.transaction((tx) =>
      reconcileCopies(tx, new Date(T0.getTime() + 5 * MIN), l.community.id, l.epoch.id),
    );
    const elapsedMs = performance.now() - started;
    expect(await l.points()).toEqual([...Array(201).fill(POINTS(85)), "0"]);
    expect(elapsedMs).toBeLessThan(5_000);
  }, 90_000);
});
