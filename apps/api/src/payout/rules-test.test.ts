import { rulesTestPasses } from "@hyphae/db";
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
    }
    expect(new Set(RULES_TESTS.map((x) => x.id)).size).toBe(RULES_TESTS.length);
  });

  it("MYCEL's test is six questions of three options, for rubric 1.2.0 only", () => {
    expect(mycel().covers).toEqual([{ community: "MYCEL", version: "1.2.0" }]);
    expect(mycel().questions.map((q) => q.options.length)).toEqual([3, 3, 3, 3, 3, 3]);
  });

  it("is looked up by the pinned rubric's community label and version", () => {
    expect(rulesTestFor({ community: "MYCEL", version: "1.2.0" })?.id).toBe("mycel-rules-1");
    expect(rulesTestFor({ community: "MYCEL", version: "1.3.0" })).toBeUndefined();
    expect(rulesTestFor({ community: "DEMO", version: "1.2.0" })).toBeUndefined();
    expect(rulesTestById("nope")).toBeUndefined();
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
    expect([...passed]).toEqual([early.member.id]);
    expect(
      await passesBefore(t.db, { memberIds: [], testId: "mycel-rules-1", before: cutoff }),
    ).toEqual(new Set());
  });
});
