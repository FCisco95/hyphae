import { readFileSync } from "node:fs";
import { rulesTestPasses } from "@hyphae/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import {
  grade,
  passesBefore,
  RULES_TESTS,
  recordPass,
  rulesTestById,
  rulesTestFor,
} from "./rules-test.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const mycel = () => {
  const test = rulesTestById("mycel-rules-1");
  if (!test) throw new Error("mycel-rules-1 is not registered");
  return test;
};
const correct = () => mycel().questions.map((q) => q.answer);

describe("the registered rules tests", () => {
  it("are well formed and fit a 64-byte button payload", () => {
    for (const test of RULES_TESTS) {
      expect(test.id).toMatch(/^[a-z0-9-]{1,13}$/);
      expect(test.covers.length).toBeGreaterThan(0);
      expect(test.questions.length).toBeGreaterThan(0);
      expect(test.questions.length).toBeLessThanOrEqual(8);
      for (const q of test.questions) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.options.length).toBeLessThanOrEqual(4);
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length).toBe(
          true,
        );
        expect(q.why.length).toBeGreaterThan(0);
      }
      expect(test.study).toMatch(/^\/[a-z0-9/-]*$/);
    }
    expect(new Set(RULES_TESTS.map((x) => x.id)).size).toBe(RULES_TESTS.length);
  });

  it("MYCEL's test is six questions of three options, for rubric 1.2.0 only", () => {
    expect(mycel().covers).toEqual([{ community: "MYCEL", version: "1.2.0" }]);
    expect(mycel().questions.map((q) => q.options.length)).toEqual([3, 3, 3, 3, 3, 3]);
  });

  it("is looked up by the pinned rubric's community label and version", () => {
    expect(rulesTestFor({ community: "MYCEL", version: "1.2.0" })?.id).toBe("mycel-rules-1");
    expect(rulesTestFor({ community: "MYCEL", version: "1.3.0" })?.id).toBe("mycel-rules-2");
    expect(rulesTestFor({ community: "MYCEL", version: "1.4.0" })).toBeUndefined();
    expect(rulesTestFor({ community: "DEMO", version: "1.2.0" })).toBeUndefined();
    expect(rulesTestById("nope")).toBeUndefined();
  });
});

describe("mycel-rules-2", () => {
  const v2 = () => {
    const test = rulesTestById("mycel-rules-2");
    if (!test) throw new Error("mycel-rules-2 is not registered");
    return test;
  };
  const review = JSON.parse(
    readFileSync(
      new URL("../../../../docs/rubrics/eval/mycel-synthetic-review.json", import.meta.url),
      "utf8",
    ),
  ) as { cases: { id: string; contribution: { text: string } }[] };
  const replyOf = (id: string) => review.cases.find((c) => c.id === id)?.contribution.text;

  it("is six questions of three options, for rubric 1.3.0 only, with the study page", () => {
    expect(v2().covers).toEqual([{ community: "MYCEL", version: "1.3.0" }]);
    expect(v2().questions.map((q) => q.options.length)).toEqual([3, 3, 3, 3, 3, 3]);
    expect(v2().study).toBe("/rules");
    expect(mycel().study).toBe("/rules");
  });

  // Worked examples: each question quotes a founder-graded reply word for word.
  it.each([
    [0, "synthetic-receipt-specific-criticism"],
    [1, "synthetic-grounded-uncertain-price"],
    [2, "synthetic-unsupported-price-with-hedge"],
    [3, "synthetic-multiple-ai-writing-signals"],
    [4, "synthetic-single-ai-word-false-positive-control"],
    [5, "synthetic-holder-only"],
  ])("question %i quotes the founder-graded reply %s", (i, id) => {
    const reply = replyOf(id);
    if (!reply) throw new Error(`no case ${id}`);
    expect(v2().questions[i]?.text).toContain(`“${reply}”`);
  });

  // Pinned apart from the key, so a wrong key cannot pass: each is what rubric 1.3.0 and the
  // credit rules make true for the founder-graded reply.
  it("keys the right answers", () => {
    expect(v2().questions.map((q) => q.options[q.answer])).toEqual([
      "High: a specific, useful question about the post",
      "Earns points: it grounds a price view in the post's numbers and says it is uncertain",
      "0: a price target with no reasoning breaks the rules",
      "Fake: stacked AI phrases and no real reaction",
      "Good: a specific reason, in a normal voice",
      "Allowed, but it adds nothing to the post, so it earns 0",
    ]);
  });

  // Each question's message replaces the one before, so none can point back to an earlier post.
  it("shows the post in every question", () => {
    for (const q of v2().questions) expect(q.text).toMatch(/\nPost: .+\nReply: “/);
  });

  it("does not keep its right answers in one position", () => {
    expect(new Set(v2().questions.map((q) => q.answer)).size).toBe(3);
  });
});

describe("grade", () => {
  it("passes only on every answer right", () => {
    expect(grade(mycel(), correct())).toEqual({ correct: 6, passed: true });
    const oneWrong = correct();
    oneWrong[3] = ((oneWrong[3] ?? 0) + 1) % 3;
    expect(grade(mycel(), oneWrong)).toEqual({ correct: 5, passed: false });
  });

  it("refuses an attempt that is not one answer per question", () => {
    expect(() => grade(mycel(), correct().slice(1))).toThrow();
    expect(() => grade(mycel(), [...correct(), 0])).toThrow();
    expect(() => grade(mycel(), [3, 0, 0, 0, 0, 0])).toThrow();
    expect(() => grade(mycel(), [-1, 0, 0, 0, 0, 0])).toThrow();
    expect(() => grade(mycel(), [0.5, 0, 0, 0, 0, 0])).toThrow();
  });
});

describe("recordPass", () => {
  it("keeps the first pass, timed by the database", async () => {
    const { community, member } = await seedCommunity(t.db);
    const before = Date.now();
    const first = await recordPass(t.db, {
      communityId: community.id,
      memberId: member.id,
      testId: "mycel-rules-1",
    });
    expect(first.created).toBe(true);
    expect(Math.abs(first.passedAt.getTime() - before)).toBeLessThan(60_000);

    const again = await recordPass(t.db, {
      communityId: community.id,
      memberId: member.id,
      testId: "mycel-rules-1",
    });
    expect(again).toEqual({ created: false, passedAt: first.passedAt });
  });

  it("refuses a member of another community and an unknown test", async () => {
    const a = await seedCommunity(t.db);
    const b = await seedCommunity(t.db);
    await expect(
      recordPass(t.db, {
        communityId: a.community.id,
        memberId: b.member.id,
        testId: "mycel-rules-1",
      }),
    ).rejects.toThrow();
    await expect(
      recordPass(t.db, { communityId: a.community.id, memberId: a.member.id, testId: "nope" }),
    ).rejects.toThrow();
  });
});

describe("passesBefore", () => {
  it("counts a pass strictly before the cutoff, of the named test only", async () => {
    const cutoff = new Date("2026-10-09T00:00:00.000Z");
    const early = await seedCommunity(t.db);
    const atCutoff = await seedCommunity(t.db);
    const otherTest = await seedCommunity(t.db);
    await t.db.insert(rulesTestPasses).values([
      {
        communityId: early.community.id,
        memberId: early.member.id,
        testId: "mycel-rules-1",
        passedAt: new Date(cutoff.getTime() - 1),
      },
      {
        communityId: atCutoff.community.id,
        memberId: atCutoff.member.id,
        testId: "mycel-rules-1",
        passedAt: cutoff,
      },
      {
        communityId: otherTest.community.id,
        memberId: otherTest.member.id,
        testId: "other-rules-1",
        passedAt: new Date(cutoff.getTime() - 60_000),
      },
    ]);
    const passed = await passesBefore(t.db, {
      memberIds: [early.member.id, atCutoff.member.id, otherTest.member.id],
      testId: "mycel-rules-1",
      before: cutoff,
    });
    expect(passed).toEqual(new Map([[early.member.id, "2026-10-08T23:59:59.999000Z"]]));
    expect(
      await passesBefore(t.db, { memberIds: [], testId: "mycel-rules-1", before: cutoff }),
    ).toEqual(new Map());
  });

  it("keeps microseconds, so a pass a fraction of a millisecond early still counts", async () => {
    const cutoff = new Date("2026-10-09T00:00:00.000Z");
    const { community, member } = await seedCommunity(t.db);
    await t.db.insert(rulesTestPasses).values({
      communityId: community.id,
      memberId: member.id,
      testId: "mycel-rules-1",
      passedAt: sql`'2026-10-08T23:59:59.9997Z'::timestamptz`,
    });
    expect(
      await passesBefore(t.db, { memberIds: [member.id], testId: "mycel-rules-1", before: cutoff }),
    ).toEqual(new Map([[member.id, "2026-10-08T23:59:59.999700Z"]]));
  });
});
