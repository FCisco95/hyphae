import { readFileSync } from "node:fs";
import { creditedScore, creditReason, type LooseEpochV1, type ScoreOutput } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import type { Result } from "./api.js";
import { EXAMPLES, exampleGroup, rulesStatus } from "./rules.js";

describe("rulesStatus", () => {
  const epochs = [
    { index: 4, status: "scheduled" as const },
    { index: 3, status: "open" as const },
    { index: 2, status: "closed" as const },
  ];
  const reading = (version: string) => async (index: number) =>
    ({
      ok: true,
      data: { index, config: { rubric_version: version } },
    }) as unknown as Result<LooseEpochV1>;

  it("names the rules of the open epoch", async () => {
    expect(await rulesStatus(epochs, reading("1.2.0"))).toEqual({
      state: "known",
      epoch: 3,
      now: "1.2.0",
    });
    expect(await rulesStatus(epochs, reading("1.3.0"))).toEqual({
      state: "known",
      epoch: 3,
      now: "1.3.0",
    });
  });

  it("says when the open epoch uses rules this page does not cover", async () => {
    expect(await rulesStatus(epochs, reading("1.4.0"))).toEqual({
      state: "other",
      epoch: 3,
      version: "1.4.0",
    });
  });

  it("claims nothing it could not read", async () => {
    const down = async () => ({ ok: false, reason: "unavailable" }) as const;
    expect(await rulesStatus(null, reading("1.2.0"))).toEqual({ state: "unknown" });
    expect(await rulesStatus(epochs, down)).toEqual({ state: "unknown" });
    expect(await rulesStatus([{ index: 2, status: "closed" as const }], reading("1.2.0"))).toEqual({
      state: "unknown",
    });
  });
});

// The examples are the founder-graded cases, word for word, with the credit production gives.
describe("graded examples", () => {
  const review = JSON.parse(
    readFileSync(
      new URL("../../../docs/rubrics/eval/mycel-synthetic-review.json", import.meta.url),
      "utf8",
    ),
  ) as {
    cases: {
      id: string;
      task: { targetText: string };
      contribution: { text: string };
      expectedPolicy: { requiredFlags: ScoreOutput["flags"]; expectedAiSignals?: string[] };
      founderLabels: { targetScore?: number; targetScoreRange?: [number, number] };
    }[];
  };

  it("are all sixteen founder-graded cases, once each", () => {
    expect(EXAMPLES.map((e) => e.id).sort()).toEqual(review.cases.map((c) => c.id).sort());
  });

  it.each(review.cases.map((c) => [c.id, c] as const))("%s", (id, c) => {
    const e = EXAMPLES.find((x) => x.id === id);
    const grade = c.founderLabels.targetScoreRange ?? [
      c.founderLabels.targetScore,
      c.founderLabels.targetScore,
    ];
    const output = (score: number): ScoreOutput => ({
      score,
      rubricHits: [],
      flags: c.expectedPolicy.requiredFlags,
      aiSlop: { patterns: c.expectedPolicy.expectedAiSignals ?? [], templateRhythm: false },
      reasoning: "",
    });
    const [lo, hi] = grade as [number, number];
    expect(e).toMatchObject({
      post: c.task.targetText,
      reply: c.contribution.text,
      grade,
      credited: [creditedScore(output(lo)), creditedScore(output(hi))],
      reason: creditReason(output(lo)),
    });
  });

  it("group by what they earn", () => {
    const groups = (g: string) =>
      EXAMPLES.filter((e) => exampleGroup(e) === g)
        .map((e) => e.id)
        .sort();
    expect(groups("never")).toEqual([
      "synthetic-buy-guaranteed-gains",
      "synthetic-code-only-spam",
      "synthetic-project-name-wrong-topic",
      "synthetic-unsupported-price-with-hedge",
    ]);
    expect(groups("nothing")).toEqual([
      "synthetic-holder-only",
      "synthetic-multiple-ai-writing-signals",
      "synthetic-popularity-no-quality-bonus",
      "synthetic-question-already-answered",
    ]);
    expect(groups("earns")).toHaveLength(8);
  });

  it("mark the one reply rubric 1.2.0 grades differently", () => {
    expect(EXAMPLES.filter((e) => e.under120).map((e) => e.id)).toEqual([
      "synthetic-grounded-uncertain-price",
    ]);
  });
});
