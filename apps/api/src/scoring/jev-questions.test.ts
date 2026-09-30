import { readFileSync } from "node:fs";
import { RubricSchema, ScoreFlag, type ScoringInput } from "@hyphae/core";
import type { Question } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { jevRequest } from "./jev.js";
import { DEFAULT_QUESTION_SET, DRAFT_QUESTIONS, QUESTION_SETS } from "./jev-questions.js";

const repo = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8");

// Each "### <id> (noul|score)" section of the draft, with its instruction and criteria blocks.
function documented(markdown: string) {
  const sections = markdown.split(/^### /m).slice(1);
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

const questions = (set: typeof DRAFT_QUESTIONS): Record<string, Question> => ({
  ...set.criteria,
  ...set.flags,
  ai_slop_obvious: set.aiSlopObvious,
  quality: set.quality,
});

describe("the draft question set", () => {
  const markdown = repo(DRAFT_QUESTIONS.source);

  it("is the document's questions, word for word", () => {
    expect(DRAFT_QUESTIONS.source).toBe("docs/evals/jev-questions-draft.md");
    expect(questions(DRAFT_QUESTIONS)).toEqual(documented(markdown));
  });

  it("is marked as a draft, not Cisco's set", () => {
    expect(DRAFT_QUESTIONS.id).toMatch(/^draft-/);
    expect(markdown).toContain(
      "**DRAFT by an agent for Cisco's Sep 30 session. It does not replace Cisco's question set; once Cisco's set exists, the eval uses that one.**",
    );
  });

  it("asks one question per flag, per criterion, the obvious-AI cap and quality", () => {
    expect(Object.keys(DRAFT_QUESTIONS.flags)).toEqual(ScoreFlag.options);
    for (const version of ["1.2.0", "1.3.0"]) {
      const rubric = RubricSchema.parse(JSON.parse(repo(`docs/rubrics/mycel-${version}.json`)));
      expect(Object.keys(DRAFT_QUESTIONS.criteria)).toEqual(rubric.criteria.map((c) => c.key));
    }
    expect(DRAFT_QUESTIONS.quality.criteria).toHaveLength(5);
  });

  it("weighs quality and criteria to a whole and counts yes from 0.5", () => {
    const { quality, criteria } = DRAFT_QUESTIONS.weights;
    expect(quality + criteria).toBe(1);
    expect(DRAFT_QUESTIONS.threshold).toBe(0.5);
  });

  it("builds a request for the synthetic cases under rubric 1.2.0", () => {
    const rubric = RubricSchema.parse(JSON.parse(repo("docs/rubrics/mycel-1.2.0.json")));
    const [first] = JSON.parse(repo("docs/rubrics/eval/mycel-synthetic.json")) as ScoringInput[];
    if (!first) throw new Error("fixture is empty");
    const request = jevRequest({ ...first, rubric }, DRAFT_QUESTIONS);
    expect(Object.keys(request.questions)).toHaveLength(11);
  });
});

it("defaults to the draft until Cisco's set exists", () => {
  expect(DEFAULT_QUESTION_SET).toBe(DRAFT_QUESTIONS);
  expect(Object.keys(QUESTION_SETS)).toEqual([DRAFT_QUESTIONS.id]);
});
