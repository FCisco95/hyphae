import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { creditedScore, RubricSchema, renderRewardPrompt, ScoreOutputSchema } from "@hyphae/core";
import { scoringModel } from "../src/scoring/provider.js";
import { Cases, exitCode, judge, parseRuns } from "../src/scoring/reward-cases.js";
import { callRewardModel } from "../src/scoring/run.js";

// Runs the pinned reward prompt versions over fixed replies and prints what each would credit.
// It reads the epoch's rubric file and writes nothing: no database, no Telegram.
const { values } = parseArgs({
  options: {
    cases: { type: "string" },
    rubric: { type: "string" },
    versions: { type: "string", default: "reward-eval/1,reward-eval/2" },
    runs: { type: "string", default: "1" },
    model: { type: "string" },
  },
});
if (!values.cases || !values.rubric) {
  throw new Error(
    "usage: eval-reward-prompt --cases <json> --rubric <json> [--versions a,b] [--runs n] [--model id]",
  );
}
const { tasks, cases } = Cases.parse(JSON.parse(await readFile(values.cases, "utf8")));
const rubric = RubricSchema.parse(JSON.parse(await readFile(values.rubric, "utf8")));
const model = scoringModel(
  values.model ?? process.env.SCORING_MODEL ?? "anthropic:claude-sonnet-5",
  {
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  },
);
const runs = parseRuns(values.runs ?? "1");

let misses = 0;
let errors = 0;
let costMicroUsd = 0;
for (const c of cases) {
  const task = tasks[c.task];
  if (!task) throw new Error(`case ${c.id}: unknown task ${c.task}`);
  for (const version of (values.versions ?? "").split(",")) {
    for (let run = 0; run < runs; run++) {
      const prompt = renderRewardPrompt(version, "quality", {
        rubric,
        effortCriteria: "",
        task,
        contribution: { kind: c.kind, text: c.text },
        limitations: ["text_only"],
      });
      try {
        const result = await callRewardModel(prompt, "quality", model);
        costMicroUsd += result.costMicroUsd;
        const out = ScoreOutputSchema.parse(result.output);
        const credited = creditedScore(out);
        const ok = judge(c.expect, credited);
        if (!ok) misses++;
        console.log(
          `${c.id.padEnd(30)} ${version} raw ${String(out.score).padStart(3)} credited ${String(credited).padStart(3)} ${out.flags.join("+").padEnd(34)} ${ok ? "ok" : "MISS"}`,
        );
      } catch (error) {
        errors++;
        console.log(`${c.id.padEnd(30)} ${version} ERROR ${(error as Error).message.slice(0, 60)}`);
      }
    }
  }
}
console.error(JSON.stringify({ misses, errors, costUsd: costMicroUsd / 1e6 }));
process.exitCode = exitCode({ misses, errors });
