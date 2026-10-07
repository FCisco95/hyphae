import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { creditedScore, RubricSchema } from "@hyphae/core";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { liveJev, runJev } from "../src/scoring/jev.js";
import { QUESTION_SETS } from "../src/scoring/jev-questions.js";
import { Cases, exitCode, judge, parseRuns } from "../src/scoring/reward-cases.js";

// The reward cases through Jev: the question set's answers, composed in code, then the same
// credit rules the production scorer uses. Writes nothing; one live Jev call per case and run.
const { values } = parseArgs({
  options: {
    cases: { type: "string" },
    rubric: { type: "string" },
    questions: { type: "string", default: "v3-2026-09-30" },
    runs: { type: "string", default: "1" },
  },
});
if (!values.cases || !values.rubric) {
  throw new Error(
    "usage: eval-reward-jev --cases <json> --rubric <json> [--questions id] [--runs n]",
  );
}
const apiKey = process.env.TYPESAFE_API_KEY;
if (!apiKey) throw new Error("eval-reward-jev: TYPESAFE_API_KEY is not set");
const set = QUESTION_SETS[values.questions ?? ""];
if (!set) throw new Error(`unknown question set ${values.questions}`);
const { tasks, cases } = Cases.parse(JSON.parse(await readFile(values.cases, "utf8")));
const rubric = RubricSchema.parse(JSON.parse(await readFile(values.rubric, "utf8")));
const backend = liveJev(new TypeSafeClient({ apiKey }));
const runs = parseRuns(values.runs ?? "1");

let misses = 0;
let errors = 0;
let costMicroUsd = 0;
for (const c of cases) {
  const task = tasks[c.task];
  if (!task) throw new Error(`case ${c.id}: unknown task ${c.task}`);
  for (let run = 0; run < runs; run++) {
    try {
      const r = await runJev(
        { rubric, task, contribution: { kind: c.kind, text: c.text } },
        set,
        backend,
      );
      costMicroUsd += r.costMicroUsd;
      const credited = creditedScore(r.output);
      const ok = judge(c.expect, credited);
      if (!ok) misses++;
      console.log(
        `${c.id.padEnd(30)} raw ${String(r.output.score).padStart(3)} credited ${String(credited).padStart(3)} ${r.output.flags.join("+").padEnd(34)} ${ok ? "ok" : "MISS"}`,
      );
    } catch (error) {
      errors++;
      console.log(`${c.id.padEnd(30)} ERROR ${(error as Error).message.split("\n")[0]}`);
    }
  }
}
console.log(JSON.stringify({ misses, errors, costUsd: costMicroUsd / 1e6 }));
process.exit(exitCode({ misses, errors }));
