import { JEV_MODEL, type JevQuestionSet, jevRequest, requestHash, runJev } from "./jev.js";
import { QUESTIONS_V4 } from "./jev-questions.js";
import { type JevRegistry, type JevScorerDef, jevTemplateHash } from "./scorers.js";

function jevScorer(version: string, set: JevQuestionSet): JevScorerDef {
  return {
    version,
    effortVersion: "reward-eval/2",
    templateHash: jevTemplateHash(JEV_MODEL, set),
    model: `typesafe:${JEV_MODEL}`,
    request: (input) => {
      const body = jevRequest(input, set);
      return { body, hash: requestHash(body) };
    },
    run: async (input, transport) => {
      const r = await runJev(input, set, transport);
      return {
        output: r.output,
        requestHash: r.requestHash,
        latencyMs: r.latencyMs,
        costMicroUsd: r.costMicroUsd,
        evidence: {
          questionSet: r.questionSet,
          model: r.model,
          rubricVersion: r.rubricVersion,
          configurationHash: r.configurationHash,
          composition: r.composition,
          usage: r.usage,
          answers: r.answers,
        },
      };
    },
  };
}

// Jev scorers this build knows by version; an epoch pins one exactly as it pins a prompt version.
// The template hash covers the questions and weights; the composition rules are jev.ts's version
// "2", so changing them means a new question set id and a new scorer version, never an edit here.
export const JEV_REGISTRY: JevRegistry = new Map([
  ["reward-jev/1", jevScorer("reward-jev/1", QUESTIONS_V4)],
]);
