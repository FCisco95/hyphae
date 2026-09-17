import type { ScoreOutput } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import { scoreMessage } from "./score-message.js";

const output = (over: Partial<ScoreOutput> = {}): ScoreOutput => ({
  score: 84,
  rubricHits: [],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "You named the fee split and asked where the receipt is.",
  ...over,
});
const url = "https://hyphae.fun/x/abc";

describe("score message", () => {
  it("plain pass: credited score, reasoning, audit link", () => {
    expect(scoreMessage({ output: output(), multiplier: 1, url })).toBe(
      "Score 84/100\nYou named the fee split and asked where the receipt is.\nhttps://hyphae.fun/x/abc",
    );
  });

  it("timing decay shows raw and the multiplier", () => {
    expect(scoreMessage({ output: output(), multiplier: 0.5, url })).toContain(
      "Score 42/100 (raw 84, timing ×0.50)",
    );
  });

  it("credit rule shows raw score and the reason", () => {
    const m = scoreMessage({ output: output({ flags: ["guideline_breach"] }), multiplier: 1, url });
    expect(m).toContain("Score 0/100 (raw 84, guideline breach)");
    expect(m).toContain("Flags: guideline_breach");
  });

  it("ai_slop lists the patterns the model named", () => {
    const m = scoreMessage({
      output: output({
        flags: ["ai_slop"],
        aiSlop: { patterns: ["landscape", "testament"], templateRhythm: false },
      }),
      multiplier: 1,
      url,
    });
    expect(m).toContain("Score 79/100 (raw 84, reads AI-written, capped at 79)");
    expect(m).toContain("Flags: ai_slop (landscape, testament)");
  });

  it("timing and credit rule compose: credit first, then timing", () => {
    const m = scoreMessage({
      output: output({ flags: ["ai_slop"], aiSlop: { patterns: ["x"], templateRhythm: false } }),
      multiplier: 0.5,
      url,
    });
    expect(m).toContain("Score 40/100 (raw 84, reads AI-written, capped at 79, timing ×0.50)");
  });
});
