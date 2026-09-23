import {
  buildScoringPrompt,
  evidenceHash,
  type Prompt,
  promptHash,
  type RewardPurpose,
  rewardOutputSchema,
  ScoreOutputSchema,
  type ScoringInput,
  type ScoringRunRecord,
} from "@hyphae/core";
import { generateText, Output } from "ai";
import type { ScoringModel } from "./provider.js";

export interface ScoringResult extends ScoringRunRecord {
  evidenceHash: string;
  latencyMs: number;
  costMicroUsd: number;
}

export async function runScoring(input: ScoringInput, m: ScoringModel): Promise<ScoringResult> {
  const prompt = buildScoringPrompt(input);
  const started = Date.now();
  const result = await generateText({
    model: m.model,
    system: prompt.system,
    prompt: prompt.user,
    output: Output.object({ schema: ScoreOutputSchema }),
    maxRetries: 2,
  });
  if (result.finishReason === "content-filter") throw new Error(`scoring: ${m.id} refused`);
  const record: ScoringRunRecord = {
    model: m.id,
    rubricVersion: input.rubric.version,
    promptHash: promptHash(prompt),
    input,
    output: result.output,
  };
  return {
    ...record,
    evidenceHash: evidenceHash(record),
    latencyMs: Date.now() - started,
    costMicroUsd: m.costMicroUsd(result.usage),
  };
}

// Upper bound on one reward call; the reconciliation horizon must exceed it.
export const REWARD_CALL_TIMEOUT_MS = 90_000;

// Reward evaluation calls are never retried by the SDK: a retry after a possibly executed
// request could bill twice (O2). Failures go to reconciliation instead.
export async function callRewardModel(prompt: Prompt, purpose: RewardPurpose, m: ScoringModel) {
  const started = Date.now();
  const result = await generateText({
    model: m.model,
    system: prompt.system,
    prompt: prompt.user,
    output: Output.object({ schema: rewardOutputSchema(purpose) }),
    maxRetries: 0,
    timeout: REWARD_CALL_TIMEOUT_MS,
  });
  if (result.finishReason === "content-filter") throw new Error(`scoring: ${m.id} refused`);
  return {
    output: result.output as unknown,
    latencyMs: Date.now() - started,
    costMicroUsd: m.costMicroUsd(result.usage),
  };
}
