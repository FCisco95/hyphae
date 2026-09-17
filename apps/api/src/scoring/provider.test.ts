import { describe, expect, it } from "vitest";
import { scoringModel } from "./provider.js";

const keys = { anthropic: "sk-ant-test", deepseek: "sk-ds-test" };

describe("scoring provider", () => {
  it("prices usage in micro-USD from the per-1M table", () => {
    const m = scoringModel("anthropic:claude-sonnet-5", keys);
    expect(m.id).toBe("anthropic:claude-sonnet-5");
    // 1,000 in @ $3/1M = 3,000 µ$; 100 out @ $15/1M = 1,500 µ$
    expect(m.costMicroUsd({ inputTokens: 1000, outputTokens: 100 })).toBe(4500);
    expect(m.costMicroUsd({ inputTokens: undefined, outputTokens: undefined })).toBe(0);
  });

  it("builds a deepseek model from the same config string", () => {
    const m = scoringModel("deepseek:deepseek-flash", keys);
    const model = m.model as { provider: string; modelId: string };
    expect(model.provider).toContain("deepseek");
    expect(model.modelId).toBe("deepseek-flash");
  });

  it("refuses unknown models and missing keys", () => {
    expect(() => scoringModel("openai:gpt-4.1", keys)).toThrow(/unknown model/);
    expect(() => scoringModel("anthropic:claude-sonnet-5", { deepseek: "x" })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });
});
