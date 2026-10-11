import {
  CLAUDE_MODEL,
  claudeCostMicroUsd,
  claudeRequest,
  claudeRequestHash,
  claudeTemplateHash,
  runClaude,
} from "./claude-questions.js";
import type { GatedQuestionSet } from "./jev.js";
import { QUESTIONS_V4 } from "./jev-questions.js";
import type { JevRegistry, JevScorerDef } from "./scorers.js";

function claudeScorer(version: string, set: GatedQuestionSet): JevScorerDef {
  return {
    version,
    effortVersion: "reward-eval/2",
    templateHash: claudeTemplateHash(set),
    model: `anthropic:${CLAUDE_MODEL}`,
    request: (input) => {
      const body = claudeRequest(input, set);
      return { body, hash: claudeRequestHash(body) };
    },
    run: async (input, transport) => {
      const r = await runClaude(input, set, transport);
      return {
        output: r.output,
        requestHash: r.requestHash,
        latencyMs: r.latencyMs,
        costMicroUsd: r.costMicroUsd,
        evidence: {
          questionSet: r.questionSet,
          model: r.model,
          messageId: r.messageId,
          rubricVersion: r.rubricVersion,
          configurationHash: r.configurationHash,
          composition: r.composition,
          usage: r.usage,
          answers: r.answers,
        },
      };
    },
    costOf: claudeCostMicroUsd,
  };
}

// Claude question scorers this build knows by version. They answer a Jev question set, so they
// route, pin and compose like a Jev scorer; only the engine behind the one call differs. Changing
// the model, a request setting, the prompt text or a question means a new version, never an edit.
export const CLAUDE_REGISTRY: JevRegistry = new Map([
  ["reward-eval/3", claudeScorer("reward-eval/3", QUESTIONS_V4)],
]);
