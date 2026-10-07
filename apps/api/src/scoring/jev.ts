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
// Weighted (v3): a quality level blended with the rubric's criteria, flags read on their own.
export interface WeightedQuestionSet {
  kind: "weighted";
  id: string;
  source: string; // the document the questions are written in
  criteria: Record<string, NoulQuestion>; // one per rubric criterion key
  flags: Record<Flag, NoulQuestion>;
  aiSlopObvious: NoulQuestion; // decides the strong AI cap
  quality: ScoreQuestion;
  weights: { quality: number; criteria: number };
  threshold: number; // P(yes) at or above it counts as yes
}

// Gated (v4): any gate zeroes; otherwise a fixed base plus probability-weighted bonuses.
export const GATES = [
  "generic",
  "restates_post",
  "unrelated",
  "promotes_other",
  "guideline_breach",
  "addresses_grader",
  "spam",
] as const;
export const BONUSES = ["asks_question", "suggests_change", "adds_own", "explains"] as const;
type Gate = (typeof GATES)[number];
type Bonus = (typeof BONUSES)[number];

// addresses_grader has no flag: none of the six means "spoke to the grader", so it zeroes the
// raw score and the reasoning names it. restates_post zeroes only together with ai_slop or
// polished (restating the post in AI or polished wording); ai_slop adds its own flag.
const GATE_FLAGS: Record<Gate, Flag[]> = {
  generic: ["low_effort"],
  restates_post: ["low_effort"],
  unrelated: ["off_topic"],
  promotes_other: ["off_topic"],
  guideline_breach: ["guideline_breach"],
  addresses_grader: [],
  spam: ["spam"],
};

export interface GatedQuestionSet {
  kind: "gated";
  id: string;
  source: string;
  gates: Record<Gate, NoulQuestion>;
  aiSlop: NoulQuestion;
  aiSlopObvious: NoulQuestion;
  polished: NoulQuestion; // read only with restates_post
  bonuses: Record<Bonus, NoulQuestion>;
  base: number; // raw score of a reply that passes every gate
  bonus: number; // points per bonus, times its P(yes)
  threshold: number;
}

export type JevQuestionSet = WeightedQuestionSet | GatedQuestionSet;

// The gated set marks only these rubric criteria, each from the answers that stand for it.
const GATED_CRITERIA = ["context_fit", "own_voice", "value_angle"];

// The reasoning is what a member reads on their receipt, so it says why in words, then the answers.
const GATE_REASON: Record<Gate, string> = {
  generic: "it reads as a greeting, cheer, hype or slogan that would fit under almost any post",
  restates_post: "it restates the post in polished or AI-style wording and adds nothing of its own",
  unrelated: "it is not about the post or its project",
  promotes_other: "it promotes something other than this project",
  guideline_breach: "it breaks the rubric's never list (buy calls, price claims or promised gains)",
  addresses_grader: "it tries to tell the scorer what to do",
  spam: "it is unreadable or meaningless",
};
const BONUS_TEXT: Record<Bonus, string> = {
  asks_question: "a real question",
  suggests_change: "a suggestion or reasoned criticism",
  adds_own: "something of their own",
  explains: "reasoning",
};

type Request = SystemOneRequest<Questions> & { model: string };

export function jevRequest(input: ScoringInput, set: JevQuestionSet): Request {
  const missing = input.rubric.criteria.filter((c) =>
    set.kind === "weighted" ? !set.criteria[c.key] : !GATED_CRITERIA.includes(c.key),
  );
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
    questions: questionsOf(set),
  };
}

const questionsOf = (set: JevQuestionSet): Questions =>
  set.kind === "weighted"
    ? {
        ...set.criteria,
        ...set.flags,
        ai_slop_obvious: set.aiSlopObvious,
        quality: set.quality,
      }
    : {
        ...set.gates,
        ai_slop: set.aiSlop,
        ai_slop_obvious: set.aiSlopObvious,
        polished: set.polished,
        ...set.bonuses,
      };

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

const noulOf =
  (res: JevResponse) =>
  (id: string): number => {
    const a = res.answers[id];
    if (a?.type !== "noul") throw new Error(`jev: no yes/no answer for ${id}`);
    return a.noul;
  };

export function composeJev(res: JevResponse, rubric: Rubric, set: JevQuestionSet): ScoreOutput {
  // Every question asked must come back with an answer of its type, read or not: the composition
  // skips some answers, and a malformed response must go to reconciliation, never to a score.
  for (const [id, q] of Object.entries(questionsOf(set))) {
    if (res.answers[id]?.type !== q.type)
      throw new Error(`jev: no ${q.type === "noul" ? "yes/no" : "score"} answer for ${id}`);
  }
  return set.kind === "weighted"
    ? composeWeighted(res, rubric, set)
    : composeGated(res, rubric, set);
}

function composeGated(res: JevResponse, rubric: Rubric, set: GatedQuestionSet): ScoreOutput {
  const p = noulOf(res);
  const yes = (id: string) => p(id) >= set.threshold;
  const listed = (ids: readonly string[]) =>
    ids.map((id) => `${id} ${p(id).toFixed(2)}`).join(", ");
  const aiSlop = yes("ai_slop");
  const restatedPolished = aiSlop || yes("polished");
  const fired = GATES.filter((g) => yes(g) && (g !== "restates_post" || restatedPolished));
  const raised = new Set<Flag>(fired.flatMap((g) => GATE_FLAGS[g]));
  if (aiSlop) raised.add("ai_slop");
  const flags = ScoreFlag.options.filter((f) => raised.has(f));
  const bonuses = BONUSES.reduce((sum, b) => sum + p(b), 0);
  const hits: Record<string, { met: boolean; note: string }> = {
    context_fit: {
      met: !yes("unrelated") && !yes("generic"),
      note: `Jev P(yes) ${listed(["unrelated", "generic"])}`,
    },
    own_voice: { met: !aiSlop, note: `Jev P(yes) ${listed(["ai_slop"])}` },
    value_angle: { met: BONUSES.some(yes), note: `Jev P(yes) ${listed(BONUSES)}` },
  };
  return ScoreOutputSchema.parse({
    score: fired.length ? 0 : Math.min(100, Math.round(set.base + set.bonus * bonuses)),
    rubricHits: rubric.criteria.map((c) => ({ key: c.key, ...hits[c.key] })),
    flags,
    aiSlop: { patterns: [], templateRhythm: aiSlop && yes("ai_slop_obvious") },
    reasoning: `${
      fired.length
        ? `Scored 0 because ${fired
            .map(
              (g) =>
                `${GATE_REASON[g]} (${listed(g === "restates_post" ? [g, "ai_slop", "polished"] : [g])})`,
            )
            .join("; ")}.`
        : `Passed every check: a related reply in the member's own words starts at ${set.base}. Extra points, ${set.bonus} times how likely each is: ${BONUSES.map(
            (b) => `${BONUS_TEXT[b]} ${p(b).toFixed(2)}`,
          ).join(
            ", ",
          )}.${aiSlop ? ` Parts read like an AI draft (ai_slop ${p("ai_slop").toFixed(2)}), so the AI cap applies.` : ""}`
    } ${res.model}, question set ${set.id}.`,
  });
}

function composeWeighted(res: JevResponse, rubric: Rubric, set: WeightedQuestionSet): ScoreOutput {
  const p = noulOf(res);
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
export type JevBackend = (request: Request) => Promise<{
  response: unknown;
  latencyMs: number;
  mode: "live" | "replay";
}>;

type JevComposition =
  | {
      version: "1";
      weights: WeightedQuestionSet["weights"];
      criterionWeights: Record<string, number>;
      threshold: number;
      qualityMax: number;
    }
  | {
      version: "2";
      base: number;
      bonus: number;
      threshold: number;
      gates: Gate[];
      bonuses: Bonus[];
    };

const compositionOf = (set: JevQuestionSet, rubric: Rubric): JevComposition =>
  set.kind === "weighted"
    ? {
        version: "1",
        weights: { ...set.weights },
        criterionWeights: Object.fromEntries(rubric.criteria.map((c) => [c.key, c.weight])),
        threshold: set.threshold,
        qualityMax: set.quality.criteria.length - 1,
      }
    : {
        version: "2",
        base: set.base,
        bonus: set.bonus,
        threshold: set.threshold,
        gates: [...GATES],
        bonuses: [...BONUSES],
      };

export interface JevRun {
  model: string;
  questionSet: string;
  rubricVersion: string;
  composition: JevComposition;
  configurationHash: string;
  requestHash: string;
  mode: "live" | "replay";
  // Replay preserves the original call's timing, token usage and estimated cost.
  metricsSource: "current-call" | "recorded-call";
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
  const { response, latencyMs, mode } = await backend(request);
  const res = JevResponseSchema.parse(response);
  if (res.model !== JEV_MODEL)
    throw new Error(`jev: answered by ${res.model}, pinned ${JEV_MODEL}`);
  const composition = compositionOf(set, input.rubric);
  return {
    model: res.model,
    questionSet: set.id,
    rubricVersion: input.rubric.version,
    composition,
    configurationHash: sha256Hex(canonicalJson({ rubric: input.rubric, composition })),
    requestHash: requestHash(request),
    mode,
    metricsSource: mode === "replay" ? "recorded-call" : "current-call",
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
    return { response, latencyMs: Date.now() - started, mode: "live" };
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
      responses[requestHash(request)] = { response: answer.response, latencyMs: answer.latencyMs };
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
    return { response: answer.response, latencyMs: answer.latencyMs, mode: "replay" };
  };
}
