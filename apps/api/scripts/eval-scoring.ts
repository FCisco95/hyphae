import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { RubricSchema, type ScoreOutput } from "@hyphae/core";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { compareScore, type EvalCase, EvalCasesSchema } from "../src/scoring/eval.js";
import {
  JEV_MODEL,
  JevRecordingSchema,
  liveJev,
  recordedJev,
  recordingJev,
  runJev,
} from "../src/scoring/jev.js";
import { DEFAULT_QUESTION_SET, QUESTION_SETS } from "../src/scoring/jev-questions.js";
import { scoringModel } from "../src/scoring/provider.js";
import { runScoring } from "../src/scoring/run.js";

const { values } = parseArgs({
  options: {
    cases: { type: "string" },
    rubric: { type: "string" },
    backend: { type: "string", default: "sonnet" },
    model: { type: "string" },
    questions: { type: "string" },
    recorded: { type: "string" },
    record: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
for (const option of ["questions", "recorded", "record"] as const) {
  if (values[option] === undefined) continue;
  if (values.backend !== "jev") {
    throw new Error(`eval-scoring: --${option} requires --backend jev`);
  }
  if (!values[option]) throw new Error(`eval-scoring: --${option} must not be empty`);
}
if (values.recorded !== undefined && values.record !== undefined) {
  throw new Error("eval-scoring: --record and --recorded are mutually exclusive");
}
if (!values.cases || !values.rubric) {
  throw new Error(
    "usage: eval-scoring --cases <json> --rubric <json> [--backend sonnet|jev] [--model <id>] [--questions <set>] [--recorded <file> | --record <file>] [--dry-run]",
  );
}
const cases = EvalCasesSchema.parse(JSON.parse(await readFile(values.cases, "utf8")));
const rubric = RubricSchema.parse(JSON.parse(await readFile(values.rubric, "utf8")));
const input = (test: EvalCase) => ({ rubric, task: test.task, contribution: test.contribution });

async function evaluate(
  score: (test: EvalCase) => Promise<{ output: ScoreOutput; costMicroUsd: number }>,
) {
  let passed = 0;
  let costMicroUsd = 0;
  for (const test of cases) {
    const run = await score(test);
    const comparison = compareScore(run.output, test.expected);
    if (comparison.passed) passed++;
    costMicroUsd += run.costMicroUsd;
    console.log(JSON.stringify({ id: test.id, expected: test.expected, ...comparison, run }));
  }
  console.error(JSON.stringify({ passed, total: cases.length, costMicroUsd }));
  if (passed !== cases.length) process.exitCode = 1;
}

if (values.backend === "jev") {
  if (values.model) throw new Error(`eval-scoring: the Jev model is pinned to ${JEV_MODEL}`);
  const set = values.questions ? QUESTION_SETS[values.questions] : DEFAULT_QUESTION_SET;
  if (!set) throw new Error(`eval-scoring: unknown question set ${values.questions}`);
  if (values["dry-run"]) {
    console.log(
      JSON.stringify({
        cases: cases.length,
        rubricVersion: rubric.version,
        model: JEV_MODEL,
        questionSet: set.id,
      }),
    );
  } else if (values.recorded) {
    const recording = JevRecordingSchema.parse(JSON.parse(await readFile(values.recorded, "utf8")));
    if (recording.questionSet !== set.id) {
      throw new Error(`eval-scoring: the recording is for question set ${recording.questionSet}`);
    }
    await evaluate((test) => runJev(input(test), set, recordedJev(recording)));
  } else {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "eval-scoring: TYPESAFE_API_KEY is not set; replay a recorded run with --recorded <file>",
      );
    }
    const live = recordingJev(liveJev(new TypeSafeClient({ apiKey })));
    try {
      await evaluate((test) => runJev(input(test), set, live.backend));
    } finally {
      if (values.record) {
        await writeFile(values.record, `${JSON.stringify(live.recording(set), null, 2)}\n`);
      }
    }
  }
} else if (values.backend !== "sonnet") {
  throw new Error(`eval-scoring: unknown backend ${values.backend} (sonnet or jev)`);
} else if (values["dry-run"]) {
  const modelId = values.model ?? process.env.SCORING_MODEL ?? "anthropic:claude-sonnet-5";
  console.log(
    JSON.stringify({ cases: cases.length, rubricVersion: rubric.version, model: modelId }),
  );
} else {
  const modelId = values.model ?? process.env.SCORING_MODEL ?? "anthropic:claude-sonnet-5";
  const model = scoringModel(modelId, {
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  });
  await evaluate((test) => runScoring(input(test), model));
}
