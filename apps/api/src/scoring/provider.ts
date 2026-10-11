import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

// USD per 1M tokens. Anthropic list prices as of 2026-10-07 (Haiku 5.5 is $0.50/$2.50 above 100k
// prompt tokens; a scoring prompt is a few thousand); DeepSeek peak-hour prices from
// api-docs.deepseek.com/quick_start/pricing on 2026-09-17 (off-peak is half — recorded cost is
// an upper bound). Only used for the cost column in scoring_runs.
const PRICES: Record<string, { in: number; out: number }> = {
  "anthropic:claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "anthropic:claude-sonnet-5": { in: 2, out: 10 },
  "anthropic:claude-opus-5": { in: 5, out: 25 },
  "anthropic:claude-haiku-4-5": { in: 1, out: 5 },
  "deepseek:deepseek-flash": { in: 0.3, out: 1.2 },
  "deepseek:deepseek-v4-pro": { in: 1.32, out: 3.96 },
};

export interface ProviderKeys {
  anthropic?: string | undefined;
  deepseek?: string | undefined;
}

export interface TokenUsage {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}

export interface ScoringModel {
  id: string;
  model: LanguageModel;
  costMicroUsd(usage: TokenUsage): number;
}

function requireKey(name: string, value: string | undefined): string {
  if (!value) throw new Error(`scoring: ${name} is not set`);
  return value;
}

// tokens × $/1M tokens = µ$ exactly, so no unit conversion is needed.
export function costMicroUsd(id: string, u: TokenUsage): number {
  const price = PRICES[id];
  if (!price) throw new Error(`scoring: unknown model ${id}`);
  return Math.round((u.inputTokens ?? 0) * price.in + (u.outputTokens ?? 0) * price.out);
}

export function scoringModel(id: string, keys: ProviderKeys): ScoringModel {
  if (!PRICES[id]) throw new Error(`scoring: unknown model ${id}`);
  const [provider, name] = id.split(":") as [string, string];
  const model =
    provider === "anthropic"
      ? createAnthropic({ apiKey: requireKey("ANTHROPIC_API_KEY", keys.anthropic) })(name)
      : createDeepSeek({ apiKey: requireKey("DEEPSEEK_API_KEY", keys.deepseek) })(name);
  return { id, model, costMicroUsd: (u) => costMicroUsd(id, u) };
}
