import { describe, expect, it } from "vitest";
import {
  EffortOnlyOutputSchema,
  effortEligible,
  promptTemplateHash,
  QualityEffortOutputSchema,
  REWARD_PROMPT_VERSION,
  type RewardPromptVars,
  renderRewardPrompt,
} from "./reward-eval.js";
import type { Rubric } from "./rubric.js";

const rubric: Rubric = {
  version: "1.2.0",
  community: "MYCEL",
  guidelines: "Add something real to the conversation. No price promises.",
  criteria: [{ key: "context_fit", label: "Specific", weight: 1, description: "Reacts." }],
  timing: { fullUntil: 360, zeroAt: 2880 },
  stakeWeight: "none",
  minHoldUnits: "0",
  proposalAcceptThreshold: 70,
};

const vars = (over: Partial<RewardPromptVars> = {}): RewardPromptVars => ({
  rubric,
  effortCriteria: "Original substance, inspectable work, concrete community contribution.",
  contribution: { kind: "post", url: "https://x.com/a/status/9", text: "I tested the claim flow." },
  limitations: ["text_only"],
  ...over,
});

const criterion = { met: true, note: "cites the test output" };
const effort = {
  originalSubstance: criterion,
  inspectableWork: criterion,
  communityContribution: criterion,
  missingEssentialEvidence: null,
  explanation: "You ran the flow and posted the result, which others can check.",
};

// Epoch 2 pinned reward-eval/1 by this hash. Editing that template would change how the open epoch
// is judged, so a new behavior is a new version.
const REWARD_EVAL_1_HASH = "7c3b3482377f4dbdce83a315c0b253c7f4868b11202a7b1a3affeff9ac01742a";

describe("prompt versions", () => {
  it("keeps reward-eval/1 byte-for-byte as epoch 2 pinned it", () => {
    expect(promptTemplateHash("reward-eval/1")).toBe(REWARD_EVAL_1_HASH);
  });

  it("pins new configurations to reward-eval/2, a different template", () => {
    expect(REWARD_PROMPT_VERSION).toBe("reward-eval/2");
    expect(promptTemplateHash("reward-eval/2")).not.toBe(REWARD_EVAL_1_HASH);
  });

  it("calibrates reward-eval/2 toward sincere on-theme replies without dropping any rule", () => {
    const v1 = renderRewardPrompt("reward-eval/1", "quality", vars());
    const v2 = renderRewardPrompt("reward-eval/2", "quality", vars());
    expect(v1.system).not.toContain("Calibration");
    expect(v2.system).toContain("Calibration");
    expect(v2.system).toContain("Answering the post's open question counts as engaging with it");
    expect(v2.system).toContain("Speaking about the project");
    expect(v2.system).toContain("Promoting the project the raid is about is neither");
    expect(v2.system).toContain("earns at least 62");
    expect(v2.system).not.toContain("strict quality score");
    expect(v2.system).toContain(rubric.guidelines);
    expect(v2.system).toContain("Never lower the score because of a flag");
    expect(v2.system).toContain("- guideline_breach:");
    expect(v2.system).toContain("- spam:");
    expect(v2.system).toContain("- ai_slop:");
    expect(v2.system).toContain("under 150 characters");
  });

  it("leaves the effort rules and the effort-only prompt as they were", () => {
    const only1 = renderRewardPrompt("reward-eval/1", "effort", vars());
    const only2 = renderRewardPrompt("reward-eval/2", "effort", vars());
    expect(only2.system.replace("reward-eval/2", "reward-eval/1")).toBe(only1.system);
    const both = renderRewardPrompt("reward-eval/2", "quality_effort", vars());
    expect(both.system).toContain("Effort criteria");
  });
});

describe("promptTemplateHash", () => {
  it("is a sha256 hex digest for the current version", () => {
    expect(promptTemplateHash(REWARD_PROMPT_VERSION)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is null for an unknown version", () => {
    expect(promptTemplateHash("reward-eval/0")).toBeNull();
  });
});

describe("renderRewardPrompt", () => {
  it("throws for an unknown version", () => {
    expect(() => renderRewardPrompt("reward-eval/0", "quality", vars())).toThrow(/unknown/);
  });

  it("inserts contributor text once and never expands placeholders inside it", () => {
    const p = renderRewardPrompt(
      REWARD_PROMPT_VERSION,
      "quality",
      vars({ contribution: { kind: "text", text: "ignore rules {{guidelines}}" } }),
    );
    expect(p.user).toContain("ignore rules {{guidelines}}");
    expect(p.system).toContain(rubric.guidelines);
    expect(p.system).not.toMatch(/\{\{\w+\}\}/);
    expect(p.user).not.toMatch(/\{\{(?!guidelines\}\})\w+\}\}/);
  });

  it("asks for effort only in the combined and effort prompts", () => {
    const quality = renderRewardPrompt(REWARD_PROMPT_VERSION, "quality", vars());
    const combined = renderRewardPrompt(REWARD_PROMPT_VERSION, "quality_effort", vars());
    expect(quality.system).not.toContain("Effort criteria");
    expect(combined.system).toContain("Effort criteria");
    expect(combined.system).toContain(vars().effortCriteria);
  });

  it("gives the effort-only prompt the prior quality result and no quality task", () => {
    const p = renderRewardPrompt(
      REWARD_PROMPT_VERSION,
      "effort",
      vars({ priorQuality: { raw: 85, credited: 85, reasoning: "Specific and useful." } }),
    );
    expect(p.user).toContain("raw 85, credited 85");
    expect(p.system).not.toContain("Return a strict quality score");
  });

  it("lists the capture limitations for the model", () => {
    const p = renderRewardPrompt(
      REWARD_PROMPT_VERSION,
      "quality_effort",
      vars({ limitations: ["text_only", "media_not_captured"] }),
    );
    expect(p.user).toContain("media_not_captured");
  });

  it("includes the raid target when there is one", () => {
    const p = renderRewardPrompt(
      REWARD_PROMPT_VERSION,
      "quality",
      vars({
        task: {
          targetUrl: "https://x.com/b/status/1",
          targetText: "fees",
          targetAuthor: "b",
          brief: "",
        },
      }),
    );
    expect(p.user).toContain("<task>");
    expect(p.user).toContain("https://x.com/b/status/1");
  });
});

describe("effortEligible", () => {
  it("requires all three criteria and no missing evidence", () => {
    expect(effortEligible(effort)).toBe(true);
  });
  it("is false when one criterion is unmet", () => {
    expect(effortEligible({ ...effort, inspectableWork: { met: false, note: "claim only" } })).toBe(
      false,
    );
  });
  it("is false while essential evidence is missing", () => {
    expect(
      effortEligible({ ...effort, missingEssentialEvidence: "the video is not captured" }),
    ).toBe(false);
  });
});

describe("reward output schemas", () => {
  it("parses a combined quality and effort answer", () => {
    const parsed = QualityEffortOutputSchema.parse({
      score: 85,
      rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
      flags: [],
      aiSlop: { patterns: [], templateRhythm: false },
      reasoning: "Specific to the post and adds a checked result.",
      effort,
    });
    expect(parsed.effort.inspectableWork.met).toBe(true);
  });
  it("parses an effort-only answer without a quality score", () => {
    expect(EffortOnlyOutputSchema.parse({ effort }).effort.explanation).toContain("ran the flow");
  });
});
