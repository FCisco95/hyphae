import {
  canonicalJson,
  promptTemplateHash,
  type RewardPurpose,
  type ScoreOutput,
  type ScoringInput,
  sha256Hex,
} from "@hyphae/core";

// What one Jev call yields once its typed answers are composed into a reward score.
export interface JevScore {
  output: ScoreOutput;
  // Kept beside the output on the dispatch: question set id, answers, usage, composition, hashes.
  evidence: Record<string, unknown>;
  requestHash: string;
  latencyMs: number;
  costMicroUsd: number;
}

// One HTTP round trip to the provider. Same shape as the eval harness's backend, so the engine
// that composes answers is the one the harness measured.
export type JevTransport = (
  request: unknown,
) => Promise<{ response: unknown; latencyMs: number; mode: "live" | "replay" }>;

// A registered Jev scorer: a pinned version of the questions and their composition. An epoch's
// reward config pins `version` and `templateHash` exactly as it pins an Anthropic prompt version.
// The one call goes to TypeSafe's Jev model (reward-jev/1) or to Claude (claude-registry.ts).
export interface JevScorerDef {
  version: string;
  // Jev answers quality only. Effort judgments (nominations) stay on this registered prompt version.
  effortVersion: string;
  templateHash: string;
  // Recorded as the dispatch's model, e.g. typesafe:jev-1.13.0.
  model: string;
  // The exact request sent for one contribution; its hash is the dispatch's input hash.
  request(input: ScoringInput): { body: unknown; hash: string };
  // Makes the one call through `transport`, then parses and composes. Throws on a missing or
  // malformed answer, so the dispatch goes to reconciliation instead of becoming a score.
  run(input: ScoringInput, transport: JevTransport): Promise<JevScore>;
  // The cost of a paid response that failed a later check, from its usage; Jev's price when absent.
  costOf?(response: unknown): number | null;
}

export type JevRegistry = ReadonlyMap<string, JevScorerDef>;

// The pin of a Jev scorer covers the model and every question and weight, never the rubric
// (the config pins that separately) or the key (a secret).
export function jevTemplateHash(model: string, questionSet: unknown): string {
  return sha256Hex(canonicalJson({ scorer: "jev", model, questionSet }));
}

export function pinHash(version: string, jev?: JevRegistry): string | null {
  return promptTemplateHash(version) ?? jev?.get(version)?.templateHash ?? null;
}

export type Route = { kind: "prompt"; version: string } | { kind: "jev"; def: JevScorerDef };

export function routeFor(version: string, purpose: RewardPurpose, jev?: JevRegistry): Route | null {
  if (promptTemplateHash(version)) return { kind: "prompt", version };
  const def = jev?.get(version);
  if (!def) return null;
  return purpose === "quality"
    ? { kind: "jev", def }
    : { kind: "prompt", version: def.effortVersion };
}
