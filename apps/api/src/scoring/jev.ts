import {
  canonicalJson,
  type Rubric,
  ScoreFlag,
  type ScoreOutput,
  ScoreOutputSchema,
  type ScoringInput,
  sha256Hex,
} from "@hyphae/core";
import type {
  EntryType,
  NoulQuestion,
  Questions,
  ScoreQuestion,
  SystemOneRequest,
  TypeSafeClient,
} from "@typesafe-ai/sdk";
import { z } from "zod";

// Pinned, not the jev-latest alias, so a new release can't move the answers under the eval.
export const JEV_MODEL = "jev-1.13.0";
// USD per 1M input tokens for jev-1.13.0 (docs.typesafe.ai/models, 2026-09-30); output is free.
const PRICE_IN = 0.042;

type Flag = z.infer<typeof ScoreFlag>;

// The questions Jev answers about one contribution, and how code turns them into a score.
export interface JevQuestionSet {
  id: string;
  source: string; // the document the questions are written in
  criteria: Record<string, NoulQuestion>; // one per rubric criterion key
  flags: Record<Flag, NoulQuestion>;
  aiSlopObvious: NoulQuestion; // decides the strong AI cap
  quality: ScoreQuestion;
  weights: { quality: number; criteria: number };
  threshold: number; // P(yes) at or above it counts as yes
}

type Request = SystemOneRequest<Questions> & { model: string };

export function jevRequest(input: ScoringInput, set: JevQuestionSet): Request {
  const missing = input.rubric.criteria.filter((c) => !set.criteria[c.key]);
  if (missing.length) {
    throw new Error(`jev: no question for criterion ${missing.map((c) => c.key).join(", ")}`);
  }
  const { rubric, task, contribution } = input;
  const state: Record<string, EntryType> = {
    community: rubric.community,
    rubric_version: rubric.version,
    guidelines: rubric.guidelines,
    criteria: rubric.criteria.map(({ key, label, description }) => ({ key, label, description })),
  };
  if (task) {
    state.task = {
      target_author: task.targetAuthor,
      target_url: task.targetUrl,
      target_text: task.targetText,
      brief: task.brief,
    };
  }
  state.contribution = {
    kind: contribution.kind,
    ...(contribution.url && { url: contribution.url }),
    text: contribution.text,
  };
  return {
    model: JEV_MODEL,
    state,
    questions: {
      ...set.criteria,
      ...set.flags,
      ai_slop_obvious: set.aiSlopObvious,
      quality: set.quality,
    },
  };
}

export const requestHash = (request: Request): string => sha256Hex(canonicalJson(request));

const Answer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    confidence: z.number().min(0).max(1),
    probabilities: z.record(z.string(), z.number()),
  }),
]);

export const JevResponseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), Answer),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});
export type JevResponse = z.infer<typeof JevResponseSchema>;

export function composeJev(res: JevResponse, rubric: Rubric, set: JevQuestionSet): ScoreOutput {
  const p = (id: string): number => {
    const a = res.answers[id];
    if (a?.type !== "noul") throw new Error(`jev: no yes/no answer for ${id}`);
    return a.noul;
  };
  const yes = (id: string) => p(id) >= set.threshold;
  const quality = res.answers.quality;
  const top = set.quality.criteria.length - 1;
  if (quality?.type !== "score" || quality.score < 0 || quality.score > top) {
    throw new Error(`jev: quality must be a level from 0 to ${top}`);
  }
  const criteria = rubric.criteria.reduce((sum, c) => sum + c.weight * p(c.key), 0);
  const composite = set.weights.quality * (quality.score / top) + set.weights.criteria * criteria;
  const flags = ScoreFlag.options.filter(yes);
  return ScoreOutputSchema.parse({
    score: Math.min(100, Math.max(0, Math.round(100 * composite))),
    rubricHits: rubric.criteria.map((c) => ({
      key: c.key,
      met: yes(c.key),
      note: `Jev P(yes) ${p(c.key).toFixed(2)}`,
    })),
    flags,
    // Jev can't list patterns; "obvious" stands for the strong cap's condition (a templated
    // rhythm or three or more patterns), so it maps onto templateRhythm.
    aiSlop: { patterns: [], templateRhythm: flags.includes("ai_slop") && yes("ai_slop_obvious") },
    reasoning: `Composed from ${res.model} answers (question set ${set.id}): quality ${quality.score.toFixed(2)} of ${top}; ${rubric.criteria
      .map((c) => `${c.key} ${p(c.key).toFixed(2)}`)
      .join(", ")}; flags: ${flags.length ? flags.join(", ") : "none"}.`,
  });
}

// One Jev call: live through the SDK, or replayed from a recording.
export type JevBackend = (request: Request) => Promise<{ response: unknown; latencyMs: number }>;

export interface JevRun {
  model: string;
  questionSet: string;
  requestHash: string;
  latencyMs: number;
  usage: JevResponse["usage"];
  costMicroUsd: number;
  answers: JevResponse["answers"];
  output: ScoreOutput;
}

export async function runJev(
  input: ScoringInput,
  set: JevQuestionSet,
  backend: JevBackend,
): Promise<JevRun> {
  const request = jevRequest(input, set);
  const { response, latencyMs } = await backend(request);
  const res = JevResponseSchema.parse(response);
  if (res.model !== JEV_MODEL)
    throw new Error(`jev: answered by ${res.model}, pinned ${JEV_MODEL}`);
  return {
    model: res.model,
    questionSet: set.id,
    requestHash: requestHash(request),
    latencyMs,
    usage: res.usage,
    // tokens × $/1M tokens = µ$
    costMicroUsd: Math.round(res.usage.input_tokens * PRICE_IN),
    answers: res.answers,
    output: composeJev(res, input.rubric, set),
  };
}

export function liveJev(client: TypeSafeClient): JevBackend {
  return async (request) => {
    const started = Date.now();
    const response = await client.systemOne(request);
    return { response, latencyMs: Date.now() - started };
  };
}

export const JevRecordingSchema = z.object({
  model: z.literal(JEV_MODEL),
  questionSet: z.string(),
  responses: z.record(
    z.string(),
    z.object({ latencyMs: z.number().nonnegative(), response: z.unknown() }),
  ),
});
export type JevRecording = z.infer<typeof JevRecordingSchema>;

// Keeps every live answer by the hash of its exact request, for replay without a key.
export function recordingJev(backend: JevBackend) {
  const responses: JevRecording["responses"] = {};
  return {
    backend: (async (request) => {
      const answer = await backend(request);
      responses[requestHash(request)] = answer;
      return answer;
    }) satisfies JevBackend,
    recording: (set: JevQuestionSet): JevRecording => ({
      model: JEV_MODEL,
      questionSet: set.id,
      responses,
    }),
  };
}

// Replays only a request recorded byte for byte: changed questions or state need a live run.
export function recordedJev(recording: JevRecording): JevBackend {
  return async (request) => {
    const hash = requestHash(request);
    const answer = recording.responses[hash];
    if (!answer) throw new Error(`jev: no recorded Jev answer for request ${hash}`);
    return { response: answer.response, latencyMs: answer.latencyMs };
  };
}
