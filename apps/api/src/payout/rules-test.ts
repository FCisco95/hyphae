import { type Db, members, rulesTestPasses } from "@hyphae/db";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { isoUs } from "../pg.js";

// The rules test (P9): a member passes it 6/6 before an epoch's close to be payable in that epoch.
// A test covers the rubrics it teaches; a new rubric version needs its own test.
export interface RulesTest {
  id: string; // at most 13 characters, so a button payload stays within Telegram's 64 bytes
  covers: { community: string; version: string }[];
  questions: { text: string; options: string[]; answer: number; why: string }[];
}

// Public text, proposed in docs/handoffs/2026-09-26-rules-test-scope-proposal.md (RT2).
const MYCEL_RULES_1: RulesTest = {
  id: "mycel-rules-1",
  covers: [{ community: "MYCEL", version: "1.2.0" }],
  questions: [
    {
      text: "Which reply to a raid post earns points?",
      options: [
        "“lfg 🚀🚀”",
        "“The fee split going on-chain is the part I'd actually check. Where's the receipt?”",
        "“great project ser”",
      ],
      answer: 1,
      why: "It reacts to something specific in the post. Hype that would fit under any post earns zero.",
    },
    {
      text: "Can you say MYCEL's price is going up if you explain why?",
      options: [
        "Yes, if I give my reasons",
        "Yes, if I add “not financial advice”",
        "No. Never where MYCEL's or any specific coin's price is going, with or without reasons.",
      ],
      answer: 2,
      why: "Under rubric 1.2.0, saying where a specific coin's price is going breaks the rules and scores 0, whatever the effort. General market talk is opinion and is allowed.",
    },
    {
      text: "How many of your submissions count per raid?",
      options: ["One reply and one quote", "Every reply I post", "One reply, no quotes"],
      answer: 0,
      why: "The bot takes one reply and one quote per member per raid, and refuses a second of either.",
    },
    {
      text: "A raid opened 30 hours ago. Do you still get full credit?",
      options: [
        "Yes, until the raid closes",
        "No. Full credit for the first 6 hours, then it falls to 0 at 48 hours.",
        "No. Nothing after 24 hours.",
      ],
      answer: 1,
      why: "Timing is part of the rubric: full credit for 6 hours, then down to zero at 48 hours.",
    },
    {
      text: "You post a friend's reply with two words changed. What happens?",
      options: ["It scores like any reply", "It gets half points", "0 points"],
      answer: 2,
      why: "Copying another member's reply, or your own, earns zero.",
    },
    {
      text: "An AI wrote your reply and you posted it unedited. What grade?",
      options: [
        "Capped, and most likely 0. Rewrite it in your own words.",
        "Full marks if it is on topic",
        "The bot refuses it before scoring",
      ],
      answer: 0,
      why: "An unedited AI draft is capped at 79, or at 40 when it is obvious, and anything below 60 earns nothing.",
    },
  ],
};

export const RULES_TESTS: readonly RulesTest[] = [MYCEL_RULES_1];

export function rulesTestFor(
  rubric: { community: string; version: string },
  tests: readonly RulesTest[] = RULES_TESTS,
): RulesTest | undefined {
  return tests.find((t) =>
    t.covers.some((c) => c.community === rubric.community && c.version === rubric.version),
  );
}

export function rulesTestById(
  id: string,
  tests: readonly RulesTest[] = RULES_TESTS,
): RulesTest | undefined {
  return tests.find((t) => t.id === id);
}

export function grade(
  test: RulesTest,
  answers: readonly number[],
): { correct: number; passed: boolean } {
  if (answers.length !== test.questions.length) {
    throw new Error(`rules test: ${answers.length} answers for ${test.questions.length} questions`);
  }
  let correct = 0;
  test.questions.forEach((q, i) => {
    const a = answers[i];
    if (a === undefined || !Number.isInteger(a) || a < 0 || a >= q.options.length) {
      throw new Error(`rules test: answer ${i + 1} is not an option`);
    }
    if (a === q.answer) correct += 1;
  });
  return { correct, passed: correct === test.questions.length };
}

// The first pass counts; a later one changes nothing. passed_at is the database clock, like every
// other time a cutoff is compared against.
export async function recordPass(
  db: Db,
  input: { communityId: string; memberId: string; testId: string },
): Promise<{ passedAt: Date; created: boolean }> {
  if (!rulesTestById(input.testId)) throw new Error(`rules test: unknown test ${input.testId}`);
  return db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, input.memberId), eq(members.communityId, input.communityId)));
    if (!member) {
      throw new Error(`rules test: member ${input.memberId} is not in ${input.communityId}`);
    }
    const [created] = await tx
      .insert(rulesTestPasses)
      .values({ ...input, passedAt: sql`clock_timestamp()` })
      .onConflictDoNothing({ target: [rulesTestPasses.memberId, rulesTestPasses.testId] })
      .returning({ passedAt: rulesTestPasses.passedAt });
    if (created) return { passedAt: created.passedAt, created: true };
    const [existing] = await tx
      .select({ passedAt: rulesTestPasses.passedAt })
      .from(rulesTestPasses)
      .where(
        and(eq(rulesTestPasses.memberId, input.memberId), eq(rulesTestPasses.testId, input.testId)),
      );
    if (!existing) throw new Error("rules test: pass vanished after a conflict");
    return { passedAt: existing.passedAt, created: false };
  });
}

// Members among memberIds with a pass of testId strictly before `before` (P9: before closes_at),
// each with its pass time in A3's microsecond form.
export async function passesBefore(
  db: Db,
  input: { memberIds: string[]; testId: string; before: Date },
): Promise<Map<string, string>> {
  if (input.memberIds.length === 0) return new Map();
  const rows = await db
    .select({ memberId: rulesTestPasses.memberId, passedAt: isoUs(rulesTestPasses.passedAt) })
    .from(rulesTestPasses)
    .where(
      and(
        inArray(rulesTestPasses.memberId, input.memberIds),
        eq(rulesTestPasses.testId, input.testId),
        lt(rulesTestPasses.passedAt, input.before),
      ),
    );
  return new Map(rows.map((r) => [r.memberId, r.passedAt]));
}
