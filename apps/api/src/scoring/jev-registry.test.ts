import { readFileSync } from "node:fs";
import { canonicalJson, RubricSchema, type ScoringInput } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import { JEV_MODEL, requestHash } from "./jev.js";
import { QUESTIONS_V4 } from "./jev-questions.js";
import { JEV_REGISTRY } from "./jev-registry.js";
import { jevTemplateHash } from "./scorers.js";

const rubric = RubricSchema.parse(
  JSON.parse(
    readFileSync(new URL("../../../../docs/rubrics/mycel-1.2.0.json", import.meta.url), "utf8"),
  ),
);
const input: ScoringInput = {
  rubric,
  task: {
    targetUrl: "https://x.com/a/status/1",
    targetAuthor: "a",
    targetText: "Post.",
    brief: "",
  },
  contribution: { kind: "reply", text: "which rubric line did i miss?" },
};

const answers = (p: Record<string, number>) =>
  Object.fromEntries(
    [
      ...Object.keys(QUESTIONS_V4.gates),
      "ai_slop",
      "ai_slop_obvious",
      "polished",
      ...Object.keys(QUESTIONS_V4.bonuses),
    ].map((id) => [id, { type: "noul", noul: p[id] ?? 0 }]),
  );

describe("the Jev registry", () => {
  const def = JEV_REGISTRY.get("reward-jev/1");

  it("registers question set v4 as reward-jev/1, and nothing else", () => {
    expect([...JEV_REGISTRY.keys()]).toEqual(["reward-jev/1"]);
    expect(def?.model).toBe(`typesafe:${JEV_MODEL}`);
    expect(def?.effortVersion).toBe("reward-eval/2");
  });

  // The pin. A change to any question, weight or the model must change this on purpose.
  it("pins the model and every v4 question and weight", () => {
    expect(def?.templateHash).toBe(jevTemplateHash(JEV_MODEL, QUESTIONS_V4));
    expect(def?.templateHash).toBe(
      "c6fe2dd7811d2468039acf1db8f288a97807ae243354ddb6ab634d8ec3aef267",
    );
  });

  it("pins plain JSON, so the hash is the whole set", () => {
    expect(JSON.parse(canonicalJson(QUESTIONS_V4))).toEqual(QUESTIONS_V4);
  });

  it("commits the exact request before the call", () => {
    const { body, hash } = def?.request(input) ?? { body: null, hash: "" };
    expect(hash).toBe(requestHash(body as Parameters<typeof requestHash>[0]));
    expect(Object.keys((body as { questions: object }).questions)).toHaveLength(14);
  });

  it("composes one call into a score with its evidence", async () => {
    let sent: unknown;
    const score = await def?.run(input, async (request) => {
      sent = request;
      return {
        response: {
          model: JEV_MODEL,
          answers: answers({ asks_question: 0.9, adds_own: 0.6 }),
          usage: { input_tokens: 5000, output_tokens: 30 },
        },
        latencyMs: 40,
        mode: "live",
      };
    });
    expect(score?.output.score).toBe(80);
    expect(score?.requestHash).toBe(def?.request(input).hash);
    expect(sent).toEqual(def?.request(input).body);
    expect(score?.costMicroUsd).toBe(210);
    expect(score?.latencyMs).toBe(40);
    expect(score?.evidence).toMatchObject({
      questionSet: "v4-2026-10-07",
      model: JEV_MODEL,
      rubricVersion: "1.2.0",
      composition: { version: "2", base: 65, bonus: 10 },
      usage: { input_tokens: 5000, output_tokens: 30 },
    });
    expect((score?.evidence.answers as Record<string, unknown>).asks_question).toEqual({
      type: "noul",
      noul: 0.9,
    });
  });

  it("refuses a response with an answer missing", async () => {
    const partial = answers({});
    delete partial.explains;
    await expect(
      def?.run(input, async () => ({
        response: {
          model: JEV_MODEL,
          answers: partial,
          usage: { input_tokens: 1, output_tokens: 0 },
        },
        latencyMs: 1,
        mode: "live",
      })),
    ).rejects.toThrow(/explains/);
  });
});
