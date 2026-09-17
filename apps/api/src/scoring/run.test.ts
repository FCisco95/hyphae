import type { Rubric, ScoreOutput } from "@hyphae/core";
import { buildScoringPrompt, promptHash } from "@hyphae/core";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { ScoringModel } from "./provider.js";
import { runScoring } from "./run.js";

const rubric: Rubric = {
  version: "1.0.0",
  community: "MYCEL",
  guidelines: "No price promises. No shilling to strangers. Add something real.",
  criteria: [
    { key: "context_fit", label: "Specific", weight: 1, description: "Reacts to the post." },
  ],
  timing: { fullUntil: 360, zeroAt: 2880 },
  stakeWeight: "none",
  minHoldUnits: "0",
  proposalAcceptThreshold: 70,
};

const output: ScoreOutput = {
  score: 84,
  rubricHits: [{ key: "context_fit", met: true, note: "names the fee split" }],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "You reacted to the fee split specifically and asked a real question.",
};

const usage = {
  inputTokens: { total: 1000, noCache: 1000, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 100, text: 100, reasoning: undefined },
};

const fake = (text: string, finishReason: "stop" | "content-filter" = "stop"): ScoringModel => ({
  id: "test:fake",
  model: new MockLanguageModelV3({
    doGenerate: {
      content: text ? [{ type: "text", text }] : [],
      finishReason: { unified: finishReason, raw: finishReason },
      usage,
      warnings: [],
    },
  }),
  costMicroUsd: (u) => (u.inputTokens ?? 0) * 3 + (u.outputTokens ?? 0) * 15,
});

const input = { rubric, contribution: { kind: "reply" as const, text: "where's the receipt?" } };

describe("runScoring", () => {
  it("records model, rubric version, prompt hash, parsed output, cost and latency", async () => {
    const r = await runScoring(input, fake(JSON.stringify(output)));
    expect(r.model).toBe("test:fake");
    expect(r.rubricVersion).toBe("1.0.0");
    expect(r.promptHash).toBe(promptHash(buildScoringPrompt(input)));
    expect(r.output).toEqual(output);
    expect(r.costMicroUsd).toBe(4500);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects output that violates the schema instead of storing it", async () => {
    await expect(
      runScoring(input, fake(JSON.stringify({ ...output, score: 101 }))),
    ).rejects.toThrow();
  });

  it("surfaces a refusal as an error, not a score", async () => {
    await expect(runScoring(input, fake("", "content-filter"))).rejects.toThrow(
      /refus|content-filter|No object/i,
    );
  });
});
