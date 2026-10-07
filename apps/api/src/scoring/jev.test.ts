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

  it("refuses a response missing an answer", () => {
    const r = response(allCriteria(1));
    delete (r.answers as Record<string, unknown>).spam;
    expect(() => composeJev(JevResponseSchema.parse(r), rubric, set)).toThrow(/spam/);
  });
});

describe("runJev", () => {
  const backend =
    (body: unknown, latencyMs = 12): JevBackend =>
    async () => ({ response: body, latencyMs, mode: "live" });

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
    expect(changed.composition.criterionWeights).toEqual({
      context_fit: 0,
      own_voice: 0,
      value_angle: 1,
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
