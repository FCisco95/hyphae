import { readFileSync } from "node:fs";
import { RubricSchema, ScoreFlag, type ScoringInput } from "@hyphae/core";
import type { Question } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { jevRequest } from "./jev.js";
import { DEFAULT_QUESTION_SET, QUESTION_SETS, QUESTIONS_V1 } from "./jev-questions.js";

const repo = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");

// Each "### <id> (noul|score)" section of the draft, with its instruction and criteria blocks.
function documented(markdown: string) {
  const sections = markdown
    .split(/^### /m)
    .slice(1)
    .filter((section) => /^\w+ \((noul|score)\)/.test(section));
  return Object.fromEntries(
    sections.map((section) => {
      const [, id, type] = section.match(/^(\w+) \((noul|score)\)/) ?? [];
      const instructions = section.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1];
      const criteria = section.match(/```json\r?\n([\s\S]*?)\r?\n```/)?.[1];
      if (!id || !instructions || !criteria)
        throw new Error(`malformed section: ${section.slice(0, 40)}`);
      return [id, { type, instructions, criteria: JSON.parse(criteria) }];
    }),
  );
}

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

// True when the questions contain the reply's run of words: any five in a row for a longer reply,
// all of it for a shorter one.
function quotes(asked: string[], reply: string[]): boolean {
  const size = Math.min(5, reply.length);
  const haystack = ` ${asked.join(" ")} `;
  for (let i = 0; size > 0 && i + size <= reply.length; i++) {
    if (haystack.includes(` ${reply.slice(i, i + size).join(" ")} `)) return true;
  }
  return false;
}

const questions = (set: typeof QUESTIONS_V1): Record<string, Question> => ({
  ...set.criteria,
  ...set.flags,
  ai_slop_obvious: set.aiSlopObvious,
  quality: set.quality,
});

describe("the draft question set", () => {
  const markdown = repo(QUESTIONS_V1.source);

  it("is the document's questions, word for word", () => {
    expect(QUESTIONS_V1.source).toBe("docs/evals/jev-questions.md");
    expect(questions(QUESTIONS_V1)).toEqual(documented(markdown));
  });

  it("says who wrote it and who ruled on it", () => {
    expect(QUESTIONS_V1.id).toBe("v1-2026-09-30");
    expect(markdown).toContain(
      "Drafted by an agent, then ruled on and amended by Cisco in session on 2026-09-30",
    );
    for (const n of [1, 2, 3, 4, 5]) expect(markdown).toContain(`### Ruling ${n}`);
  });

  it("names the backwards-sentence tell in both AI-writing questions (ruling 5)", () => {
    const asked = questions(QUESTIONS_V1);
    for (const id of ["own_voice", "ai_slop"]) {
      expect(asked[id]?.instructions).toContain("built backwards");
      expect(asked[id]?.instructions).toContain("Buying the coin is what I'm going to do");
    }
  });

  it("never quotes a fixture reply, so the eval cannot leak its answers", () => {
    const asked = words(JSON.stringify(questions(QUESTIONS_V1)));
    const cases = JSON.parse(repo("docs/rubrics/eval/mycel-synthetic.json")) as {
      id: string;
      contribution: { text: string };
    }[];
    for (const { id, contribution } of cases) {
      expect(quotes(asked, words(contribution.text)), `${id} is quoted`).toBe(false);
    }
  });

  it("catches a quote of five words or a whole reply shorter than that", () => {
    const asked = words("Ask whether the author says I hold MYCEL and when do claims close, ok?");
    expect(quotes(asked, words("I hold MYCEL."))).toBe(true);
    expect(quotes(asked, words("When do claims close?"))).toBe(true);
    expect(quotes(asked, words("Nothing like it in the questions."))).toBe(false);
    expect(quotes(asked, words("Author says I hold MYCEL and when do claims"))).toBe(true);
  });

  it("asks one question per flag, per criterion, the obvious-AI cap and quality", () => {
    expect(Object.keys(QUESTIONS_V1.flags)).toEqual(ScoreFlag.options);
    for (const version of ["1.2.0", "1.3.0"]) {
      const rubric = RubricSchema.parse(JSON.parse(repo(`docs/rubrics/mycel-${version}.json`)));
      expect(Object.keys(QUESTIONS_V1.criteria)).toEqual(rubric.criteria.map((c) => c.key));
    }
    expect(QUESTIONS_V1.quality.criteria).toHaveLength(5);
  });

  it("weighs quality and criteria to a whole and counts yes from 0.5", () => {
    const { quality, criteria } = QUESTIONS_V1.weights;
    expect(quality + criteria).toBe(1);
    expect(QUESTIONS_V1.threshold).toBe(0.5);
  });

  it("builds a request for the synthetic cases under rubric 1.2.0", () => {
    const rubric = RubricSchema.parse(JSON.parse(repo("docs/rubrics/mycel-1.2.0.json")));
    const [first] = JSON.parse(repo("docs/rubrics/eval/mycel-synthetic.json")) as ScoringInput[];
    if (!first) throw new Error("fixture is empty");
    const request = jevRequest({ ...first, rubric }, QUESTIONS_V1);
    expect(Object.keys(request.questions)).toHaveLength(11);
  });
});

it("defaults to the ruled set", () => {
  expect(DEFAULT_QUESTION_SET).toBe(QUESTIONS_V1);
  expect(Object.keys(QUESTION_SETS)).toEqual([QUESTIONS_V1.id]);
});
