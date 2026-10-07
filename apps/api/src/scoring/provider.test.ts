import { describe, expect, it } from "vitest";
import { scoringModel } from "./provider.js";

const keys = { anthropic: "sk-ant-test", deepseek: "sk-ds-test" };

describe("scoring provider", () => {
  it("prices usage in micro-USD from the per-1M table", () => {
    const m = scoringModel("anthropic:claude-sonnet-5", keys);
    expect(m.id).toBe("anthropic:claude-sonnet-5");
    // 1,000 in @ $2/1M = 2,000 µ$; 100 out @ $10/1M = 1,000 µ$
    expect(m.costMicroUsd({ inputTokens: 1000, outputTokens: 100 })).toBe(3000);
    expect(m.costMicroUsd({ inputTokens: undefined, outputTokens: undefined })).toBe(0);
  });

  it("prices Haiku 5.5 at $0.10 in / $0.50 out per 1M tokens", () => {
    const m = scoringModel("anthropic:claude-haiku-5-5", keys);
    expect(m.id).toBe("anthropic:claude-haiku-5-5");
    expect((m.model as { modelId: string }).modelId).toBe("claude-haiku-5-5");
    // 1,000 in @ $0.10/1M = 100 µ$; 100 out @ $0.50/1M = 50 µ$
    expect(m.costMicroUsd({ inputTokens: 1000, outputTokens: 100 })).toBe(150);
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
