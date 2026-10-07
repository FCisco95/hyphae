import { readFileSync } from "node:fs";
import {
  creditedScore,
  type Rubric,
  RubricSchema,
  ScoreFlag,
  ScoreOutputSchema,
  type ScoringInput,
} from "@hyphae/core";
import { noul, score } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  composeJev,
  JEV_MODEL,
  type JevBackend,
  type JevQuestionSet,
  JevResponseSchema,
  jevRequest,
  recordedJev,
  recordingJev,
  requestHash,
  runJev,
} from "./jev.js";

const rubric: Rubric = RubricSchema.parse(
  JSON.parse(
    readFileSync(new URL("../../../../docs/rubrics/mycel-1.2.0.json", import.meta.url), "utf8"),
  ),
);

const yesNo = (id: string) => noul(`Is ${id} true of \`contribution.text\`?`);
const set: JevQuestionSet = {
  kind: "weighted",
  id: "test-set",
  source: "jev.test.ts",
  criteria: { context_fit: yesNo("fit"), own_voice: yesNo("voice"), value_angle: yesNo("angle") },
  flags: {
    off_topic: yesNo("off topic"),
    low_effort: yesNo("low effort"),
    ai_slop: yesNo("an AI draft"),
    link_mismatch: yesNo("a link mismatch"),
    spam: yesNo("spam"),
    guideline_breach: yesNo("a breach"),
  },
  aiSlopObvious: yesNo("an obvious AI draft"),
  quality: score("How good is `contribution.text`?", ["none", "weak", "fair", "good", "great"]),
  weights: { quality: 0.5, criteria: 0.5 },
  threshold: 0.5,
};

const input: ScoringInput = {
  rubric,
  task: {
    targetUrl: "https://x.com/example/status/123",
    targetText: "We published the fee split today.",
    targetAuthor: "example",
    brief: "React in your own words.",
  },
  contribution: { kind: "reply", text: "Can we check each payout against those receipts?" },
};

type Answers = Record<string, number>;
const CRITERIA = ["context_fit", "own_voice", "value_angle"];
const noulIds = [...CRITERIA, ...ScoreFlag.options, "ai_slop_obvious"];

function response(p: Answers = {}, quality = 3, model = JEV_MODEL) {
  const answers: Record<string, unknown> = {};
  for (const id of noulIds) answers[id] = { type: "noul", noul: p[id] ?? 0 };
  answers.quality = {
    type: "score",
    score: quality,
    confidence: 0.9,
    legend: { "0": "none", "1": "weak", "2": "fair", "3": "good", "4": "great" },
    probabilities: { "0": 0, "1": 0, "2": 0, "3": 1, "4": 0 },
  };
  return { model, answers, usage: { input_tokens: 1000, output_tokens: 40 } };
}

const allCriteria = (v: number): Answers => Object.fromEntries(CRITERIA.map((k) => [k, v]));
const compose = (p: Answers, quality = 3) =>
  composeJev(JevResponseSchema.parse(response(p, quality)), rubric, set);

describe("jevRequest", () => {
  it("pins jev-1.13.0 and names each part of the state", () => {
    const request = jevRequest(input, set);
    expect(request.model).toBe("jev-1.13.0");
    expect(request.state).toEqual({
      community: "MYCEL",
      rubric_version: "1.2.0",
      guidelines: rubric.guidelines,
      criteria: rubric.criteria.map(({ key, label, description }) => ({ key, label, description })),
      task: {
        target_author: "example",
        target_url: "https://x.com/example/status/123",
        target_text: "We published the fee split today.",
        brief: "React in your own words.",
      },
      contribution: { kind: "reply", text: "Can we check each payout against those receipts?" },
    });
    expect(Object.keys(request.questions).sort()).toEqual([...noulIds, "quality"].sort());
  });

  it("leaves out a task that isn't there and a url that isn't there", () => {
    const state = jevRequest({ ...input, task: undefined }, set).state as Record<string, unknown>;
    expect(state).not.toHaveProperty("task");
    expect(state.contribution).toEqual({ kind: "reply", text: input.contribution.text });
  });

  it("refuses a question set without a question for each rubric criterion", () => {
    const { value_angle: _, ...criteria } = set.criteria;
    expect(() => jevRequest(input, { ...set, criteria })).toThrow(/value_angle/);
  });
});

describe("composeJev", () => {
  it("weighs the quality level and the rubric's criteria into 0-100", () => {
    expect(compose(allCriteria(1), 4).score).toBe(100);
    expect(compose(allCriteria(0), 0).score).toBe(0);
    // 0.5 × 2/4 + 0.5 × (0.35 + 0.30 + 0.35) × 0.5
    expect(compose(allCriteria(0.5), 2).score).toBe(50);
    // 0.5 × 3/4 + 0.5 × (0.35 × 1 + 0.30 × 1 + 0.35 × 0)
    expect(compose({ context_fit: 1, own_voice: 1, value_angle: 0 }, 3).score).toBe(70);
  });

  it("sets a flag at the threshold and not below it", () => {
    expect(compose({ spam: 0.5 }).flags).toEqual(["spam"]);
    expect(compose({ spam: 0.49 }).flags).toEqual([]);
    expect(compose({ guideline_breach: 0.9, off_topic: 0.7 }).flags).toEqual([
      "off_topic",
      "guideline_breach",
    ]);
  });

  it("marks a criterion met at the threshold and notes its probability", () => {
    const hits = compose({ context_fit: 0.5, own_voice: 0.2, value_angle: 0.93 }).rubricHits;
    expect(hits).toEqual([
      { key: "context_fit", met: true, note: "Jev P(yes) 0.50" },
      { key: "own_voice", met: false, note: "Jev P(yes) 0.20" },
      { key: "value_angle", met: true, note: "Jev P(yes) 0.93" },
    ]);
  });

  it("takes the strong AI cap only when the draft is also obvious", () => {
    const mild = compose({ ...allCriteria(1), ai_slop: 0.8 }, 4);
    expect(mild.aiSlop).toEqual({ patterns: [], templateRhythm: false });
    expect(creditedScore(mild)).toBe(79);
    const strong = compose({ ...allCriteria(1), ai_slop: 0.8, ai_slop_obvious: 0.8 }, 4);
    expect(strong.aiSlop.templateRhythm).toBe(true);
    expect(creditedScore(strong)).toBe(0);
    const notFlagged = compose({ ...allCriteria(1), ai_slop_obvious: 0.8 }, 4);
    expect(notFlagged.aiSlop).toEqual({ patterns: [], templateRhythm: false });
    expect(creditedScore(notFlagged)).toBe(100);
  });

  it("applies the production credit rule after composing", () => {
    expect(creditedScore(compose({ ...allCriteria(1), spam: 1 }, 4))).toBe(0);
    expect(creditedScore(compose(allCriteria(0.5), 2))).toBe(0);
  });

  it("returns a valid scorer output", () => {
    const output = compose({ ...allCriteria(0.9), low_effort: 0.6 }, 3);
    expect(ScoreOutputSchema.parse(output)).toEqual(output);
    expect(output.reasoning).toMatch(/jev-1\.13\.0/);
  });

  it("refuses a quality level outside the question's levels", () => {
    expect(() => compose(allCriteria(1), 4.5)).toThrow(/quality/);
    expect(() => compose(allCriteria(1), -0.1)).toThrow(/quality/);
  });

  it.each([
    [2, 100],
    [-1, 0],
  ])("clamps a quality weight of %s to score %s", (weight, expected) => {
    const output = composeJev(JevResponseSchema.parse(response(allCriteria(1), 4)), rubric, {
      ...set,
      weights: { quality: weight, criteria: 0 },
    });
    expect(output.score).toBe(expected);
  });

  it("takes the strong AI cap at exactly the obviousness threshold", () => {
    expect(creditedScore(compose({ ...allCriteria(1), ai_slop: 1, ai_slop_obvious: 0.5 }, 4))).toBe(
      0,
    );
    expect(
      creditedScore(compose({ ...allCriteria(1), ai_slop: 1, ai_slop_obvious: 0.499 }, 4)),
    ).toBe(79);
  });

  it("refuses a weighted response missing an answer it would not read", () => {
    const r = response({ ai_slop: 0.1 });
    delete (r.answers as Record<string, unknown>).ai_slop_obvious;
    expect(() => composeJev(JevResponseSchema.parse(r), rubric, set)).toThrow(/ai_slop_obvious/);
  });

  it("refuses a response missing an answer", () => {
    const r = response(allCriteria(1));
    delete (r.answers as Record<string, unknown>).spam;
    expect(() => composeJev(JevResponseSchema.parse(r), rubric, set)).toThrow(/spam/);
  });
});

const gated: JevQuestionSet = {
  kind: "gated",
  id: "test-gated",
  source: "jev.test.ts",
  gates: {
    generic: yesNo("generic"),
    restates_post: yesNo("a restatement"),
    unrelated: yesNo("unrelated"),
    promotes_other: yesNo("a plug"),
    guideline_breach: yesNo("a breach"),
    addresses_grader: yesNo("aimed at the grader"),
    spam: yesNo("spam"),
  },
  aiSlop: yesNo("an AI draft"),
  aiSlopObvious: yesNo("an obvious AI draft"),
  polished: yesNo("polished wording"),
  bonuses: {
    asks_question: yesNo("a question"),
    suggests_change: yesNo("a suggestion"),
    adds_own: yesNo("own material"),
    explains: yesNo("an explanation"),
  },
  base: 65,
  bonus: 10,
  threshold: 0.5,
};
const gatedIds = [
  "generic",
  "restates_post",
  "unrelated",
  "promotes_other",
  "guideline_breach",
  "addresses_grader",
  "spam",
  "ai_slop",
  "ai_slop_obvious",
  "polished",
  "asks_question",
  "suggests_change",
  "adds_own",
  "explains",
];

function gatedResponse(p: Answers = {}) {
  const answers = Object.fromEntries(
    gatedIds.map((id) => [id, { type: "noul", noul: p[id] ?? 0 }]),
  );
  return { model: JEV_MODEL, answers, usage: { input_tokens: 1000, output_tokens: 40 } };
}
const composeGated = (p: Answers) =>
  composeJev(JevResponseSchema.parse(gatedResponse(p)), rubric, gated);

describe("jevRequest with a gated set", () => {
  it("asks every gate, both AI-writing questions, the polish question and every bonus", () => {
    const request = jevRequest(input, gated);
    expect(Object.keys(request.questions).sort()).toEqual([...gatedIds].sort());
  });

  it("refuses a rubric criterion it has no answer to mark", () => {
    const extra = { key: "originality", weight: 0, label: "Original", description: "New." };
    const other = { ...rubric, criteria: [...rubric.criteria, extra] };
    expect(() => jevRequest({ ...input, rubric: other }, gated)).toThrow(/originality/);
  });
});

describe("composeJev with gates and bonuses", () => {
  it("gives a reply that passes every gate the base score", () => {
    const output = composeGated({});
    expect(output.score).toBe(65);
    expect(output.flags).toEqual([]);
  });

  it("adds each bonus weighted by its probability, up to 100", () => {
    // 65 + 10 × (1 + 0.5 + 0.25) = 82.5
    expect(composeGated({ asks_question: 1, suggests_change: 0.5, adds_own: 0.25 }).score).toBe(83);
    const all = { asks_question: 1, suggests_change: 1, adds_own: 1, explains: 1 };
    expect(composeGated(all).score).toBe(100);
  });

  it.each([
    ["generic", ["low_effort"]],
    ["unrelated", ["off_topic"]],
    ["promotes_other", ["off_topic"]],
    ["guideline_breach", ["guideline_breach"]],
    ["spam", ["spam"]],
    ["addresses_grader", []],
  ])("zeroes on %s at the threshold and sets %j", (gate, flags) => {
    const fired = composeGated({ [gate]: 0.5, asks_question: 1 });
    expect(fired.score).toBe(0);
    expect(fired.flags).toEqual(flags);
    expect(creditedScore(fired)).toBe(0);
    expect(fired.reasoning).toContain(`(${gate} 0.50`);
    expect(fired.reasoning).toMatch(/^Scored 0 because /);
    const below = composeGated({ [gate]: 0.49, asks_question: 1 });
    expect(below.score).toBe(75);
    expect(below.flags).toEqual([]);
  });

  it("zeroes a restatement only when it also reads as an AI draft or as polished", () => {
    expect(composeGated({ restates_post: 0.9, ai_slop: 0.3, polished: 0.3 }).score).toBe(65);
    const both = composeGated({ restates_post: 0.9, ai_slop: 0.6 });
    expect(both.score).toBe(0);
    expect(both.flags).toEqual(["low_effort", "ai_slop"]);
    expect(both.reasoning).toContain("restates_post");
    const polished = composeGated({ restates_post: 0.9, polished: 0.5 });
    expect(polished.score).toBe(0);
    expect(polished.flags).toEqual(["low_effort"]);
    expect(polished.reasoning).toContain("polished 0.50");
    expect(composeGated({ polished: 0.9 }).score).toBe(65);
  });

  it("flags an AI draft without zeroing it, and takes the strong cap only when obvious", () => {
    const all = { asks_question: 1, suggests_change: 1, adds_own: 1, explains: 1 };
    const mild = composeGated({ ...all, ai_slop: 0.8 });
    expect(mild.score).toBe(100);
    expect(mild.flags).toEqual(["ai_slop"]);
    expect(mild.aiSlop).toEqual({ patterns: [], templateRhythm: false });
    expect(creditedScore(mild)).toBe(79);
    const strong = composeGated({ ...all, ai_slop: 0.8, ai_slop_obvious: 0.5 });
    expect(strong.aiSlop.templateRhythm).toBe(true);
    expect(creditedScore(strong)).toBe(0);
    expect(composeGated({ ai_slop_obvious: 0.9 }).aiSlop.templateRhythm).toBe(false);
  });

  it("marks the rubric's criteria from the answers it used and notes them", () => {
    const hits = composeGated({
      generic: 0.2,
      unrelated: 0.1,
      ai_slop: 0.7,
      explains: 0.6,
    }).rubricHits;
    expect(hits.map(({ key, met }) => [key, met])).toEqual([
      ["context_fit", true],
      ["own_voice", false],
      ["value_angle", true],
    ]);
    expect(hits[0]?.note).toContain("unrelated 0.10");
    expect(hits[1]?.note).toContain("ai_slop 0.70");
    expect(hits[2]?.note).toContain("explains 0.60");
    expect(composeGated({ generic: 0.8 }).rubricHits[0]?.met).toBe(false);
    expect(composeGated({ explains: 0.4 }).rubricHits[2]?.met).toBe(false);
  });

  it("returns a valid scorer output that names the set and the base", () => {
    const output = composeGated({ asks_question: 0.9 });
    expect(ScoreOutputSchema.parse(output)).toEqual(output);
    expect(output.reasoning).toMatch(/test-gated/);
    expect(output.reasoning).toMatch(/starts at 65/);
  });

  it("explains the score in words a member can read, with the answers behind it", () => {
    const generic = composeGated({ generic: 0.98 }).reasoning;
    expect(generic).toContain("would fit under almost any post (generic 0.98)");
    const passed = composeGated({ asks_question: 0.97, adds_own: 0.71 }).reasoning;
    expect(passed).toMatch(/^Passed every check/);
    expect(passed).toContain("a real question 0.97");
    expect(passed).toContain("something of their own 0.71");
    expect(passed).toContain(`${JEV_MODEL}, question set test-gated`);
    expect(composeGated({ ai_slop: 0.8 }).reasoning).toContain("the AI cap applies");
    expect(composeGated({}).reasoning).not.toContain("AI cap");
  });

  it("refuses a response missing an answer", () => {
    const r = gatedResponse();
    delete (r.answers as Record<string, unknown>).adds_own;
    expect(() => composeJev(JevResponseSchema.parse(r), rubric, gated)).toThrow(/adds_own/);
  });

  // A malformed response must reconcile, not score, even when the missing answer would not be read.
  it.each(gatedIds)("refuses a response missing %s, whatever the other answers", (id) => {
    const r = gatedResponse();
    delete (r.answers as Record<string, unknown>)[id];
    expect(() => composeJev(JevResponseSchema.parse(r), rubric, gated)).toThrow(
      new RegExp(`for ${id}$`),
    );
  });

  it("refuses an answer of the wrong type, even one the score would not read", () => {
    const r = gatedResponse({ ai_slop: 0.9 });
    (r.answers as Record<string, unknown>).polished = {
      type: "score",
      score: 1,
      confidence: 1,
      probabilities: { "0": 0, "1": 1 },
    };
    expect(() => composeJev(JevResponseSchema.parse(r), rubric, gated)).toThrow(/polished/);
  });
});

describe("runJev", () => {
  const backend =
    (body: unknown, latencyMs = 12): JevBackend =>
    async () => ({ response: body, latencyMs, mode: "live" });

  it("records a gated composition, and a changed base changes only the configuration", async () => {
    const run = await runJev(input, gated, backend(gatedResponse({ explains: 1 })));
    expect(run.composition).toEqual({
      version: "2",
      base: 65,
      bonus: 10,
      threshold: 0.5,
      gates: gatedIds.slice(0, 7),
      bonuses: gatedIds.slice(10),
    });
    expect(run.output.score).toBe(75);
    const higher = await runJev(
      input,
      { ...gated, base: 70 },
      backend(gatedResponse({ explains: 1 })),
    );
    expect(higher.output.score).toBe(80);
    expect(higher.requestHash).toBe(run.requestHash);
    expect(higher.configurationHash).not.toBe(run.configurationHash);
  });

  it("records the pinned model, the request hash, usage and cost", async () => {
    const run = await runJev(input, set, backend(response(allCriteria(1), 4)));
    expect(run).toMatchObject({
      model: "jev-1.13.0",
      questionSet: "test-set",
      rubricVersion: "1.2.0",
      mode: "live",
      metricsSource: "current-call",
      composition: {
        version: "1",
        weights: { quality: 0.5, criteria: 0.5 },
        criterionWeights: { context_fit: 0.35, own_voice: 0.3, value_angle: 0.35 },
        threshold: 0.5,
        qualityMax: 4,
      },
      requestHash: requestHash(jevRequest(input, set)),
      latencyMs: 12,
      usage: { input_tokens: 1000, output_tokens: 40 },
      // $0.042 per million input tokens; output tokens are free.
      costMicroUsd: 42,
    });
    expect(run.output.score).toBe(100);
    expect(run.configurationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("identifies changed composition even when the recorded request stays the same", async () => {
    const live = recordingJev(
      backend(response({ context_fit: 1, own_voice: 1, value_angle: 0 }, 3)),
    );
    const first = await runJev(input, set, live.backend);
    const replay = recordedJev(live.recording(set));
    const changed = await runJev(
      {
        ...input,
        rubric: {
          ...rubric,
          criteria: rubric.criteria.map((c) => ({ ...c, weight: c.key === "value_angle" ? 1 : 0 })),
        },
      },
      set,
      replay,
    );
    expect(first.output.score).toBe(70);
    expect(changed.output.score).toBe(38);
    expect(changed.requestHash).toBe(first.requestHash);
    expect(changed.configurationHash).not.toBe(first.configurationHash);
    expect(changed.composition).toMatchObject({
      criterionWeights: { context_fit: 0, own_voice: 0, value_angle: 1 },
    });
    const recomposed = await runJev(
      input,
      { ...set, weights: { quality: 0.25, criteria: 0.75 }, threshold: 0.8 },
      replay,
    );
    expect(recomposed.requestHash).toBe(first.requestHash);
    expect(recomposed.configurationHash).not.toBe(first.configurationHash);
    expect(recomposed.composition).toMatchObject({
      weights: { quality: 0.25, criteria: 0.75 },
      threshold: 0.8,
    });
  });

  it("refuses an answer from any model but the pinned one", async () => {
    await expect(
      runJev(input, set, backend(response(allCriteria(1), 4, "jev-1.14.0"))),
    ).rejects.toThrow(/jev-1\.14\.0/);
  });

  it("refuses a malformed response", async () => {
    await expect(runJev(input, set, backend({ model: JEV_MODEL }))).rejects.toThrow();
  });
});

describe("recorded mode", () => {
  it("replays a recorded run with no key and no network", async () => {
    const live = recordingJev(async () => ({
      response: response(allCriteria(1), 4),
      latencyMs: 87,
      mode: "live",
    }));
    const first = await runJev(input, set, live.backend);
    const replayed = await runJev(input, set, recordedJev(live.recording(set)));
    expect(first.mode).toBe("live");
    expect(replayed).toEqual({ ...first, mode: "replay", metricsSource: "recorded-call" });
    expect(replayed.latencyMs).toBe(87);
  });

  it("refuses to replay a request that was never recorded", async () => {
    const live = recordingJev(async () => ({ response: response(), latencyMs: 1, mode: "live" }));
    await runJev(input, set, live.backend);
    const changed = { ...input, contribution: { kind: "reply" as const, text: "gm" } };
    await expect(runJev(changed, set, recordedJev(live.recording(set)))).rejects.toThrow(
      /no recorded Jev answer/,
    );
  });

  it.each(["model", "questions"] as const)(
    "refuses a replay after changing only %s",
    async (field) => {
      const live = recordingJev(async () => ({ response: response(), latencyMs: 1, mode: "live" }));
      const request = jevRequest(input, set);
      await live.backend(request);
      const changed =
        field === "model"
          ? { ...request, model: "jev-1.14.0" }
          : {
              ...request,
              questions: { ...request.questions, context_fit: yesNo("a different condition") },
            };
      await expect(recordedJev(live.recording(set))(changed)).rejects.toThrow(
        /no recorded Jev answer/,
      );
    },
  );
});
