import {
  buildScoringPrompt,
  evidenceHash,
  promptHash,
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
