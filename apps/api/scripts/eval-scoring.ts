import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { RubricSchema } from "@hyphae/core";
import { compareScore, EvalCasesSchema } from "../src/scoring/eval.js";
import { scoringModel } from "../src/scoring/provider.js";
import { runScoring } from "../src/scoring/run.js";

const { values } = parseArgs({
  options: {
    cases: { type: "string" },
    rubric: { type: "string" },
    model: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
if (!values.cases || !values.rubric) {
  throw new Error("usage: eval-scoring --cases <json> --rubric <json> [--model <id>] [--dry-run]");
}
const cases = EvalCasesSchema.parse(JSON.parse(await readFile(values.cases, "utf8")));
const rubric = RubricSchema.parse(JSON.parse(await readFile(values.rubric, "utf8")));
const modelId = values.model ?? process.env.SCORING_MODEL ?? "anthropic:claude-sonnet-5";

if (values["dry-run"]) {
  console.log(
    JSON.stringify({ cases: cases.length, rubricVersion: rubric.version, model: modelId }),
  );
} else {
  const model = scoringModel(modelId, {
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  });
  let passed = 0;
  let costMicroUsd = 0;
  for (const test of cases) {
    const run = await runScoring(
      { rubric, task: test.task, contribution: test.contribution },
      model,
    );
    const comparison = compareScore(run.output, test.expected);
    if (comparison.passed) passed++;
    costMicroUsd += run.costMicroUsd;
    console.log(JSON.stringify({ id: test.id, expected: test.expected, ...comparison, run }));
  }
  console.error(JSON.stringify({ passed, total: cases.length, costMicroUsd }));
  if (passed !== cases.length) process.exitCode = 1;
}
