import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  creditedScore,
  RubricSchema,
  renderRewardPrompt,
  ScoreOutputSchema,
  type ScoringInput,
} from "@hyphae/core";
import { claudeTransport } from "../src/scoring/claude-client.js";
import { CLAUDE_REGISTRY } from "../src/scoring/claude-registry.js";
import { scoringModel } from "../src/scoring/provider.js";
import { Cases, exitCode, judge, parseRuns } from "../src/scoring/reward-cases.js";
import { callRewardModel } from "../src/scoring/run.js";
import type { JevTransport } from "../src/scoring/scorers.js";

// Runs the pinned reward prompt versions, and the Claude question scorers (reward-eval/3), over
// fixed replies and prints what each would credit. It reads the epoch's rubric file and writes
// nothing but --out: no database, no Telegram.
const { values } = parseArgs({
  options: {
    cases: { type: "string" },
    rubric: { type: "string" },
    versions: { type: "string", default: "reward-eval/1,reward-eval/2" },
    runs: { type: "string", default: "1" },
    model: { type: "string" },
    out: { type: "string" },
  },
});
if (!values.cases || !values.rubric) {
  throw new Error(
    "usage: eval-reward-prompt --cases <json> --rubric <json> [--versions a,b] [--runs n] [--model id] [--out json]",
  );
}
const { tasks, cases } = Cases.parse(JSON.parse(await readFile(values.cases, "utf8")));
const rubric = RubricSchema.parse(JSON.parse(await readFile(values.rubric, "utf8")));
const model = scoringModel(
  values.model ?? process.env.SCORING_MODEL ?? "anthropic:claude-haiku-5-5",
  {
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  },
);
const runs = parseRuns(values.runs ?? "1");

// The last Claude response, so a call that fails its checks is still counted at what it cost.
let lastResponse: unknown;
let claude: JevTransport | undefined;
const sendClaude: JevTransport = async (request) => {
  claude ??= claudeTransport({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
  const answer = await claude(request);
  lastResponse = answer.response;
  return answer;
};

async function score(version: string, input: ScoringInput) {
  const def = CLAUDE_REGISTRY.get(version);
  if (def) {
    const s = await def.run(input, sendClaude);
    return { ...s, answers: s.evidence.answers as Record<string, boolean> };
  }
  const prompt = renderRewardPrompt(version, "quality", {
    ...input,
    effortCriteria: "",
    limitations: ["text_only"],
  });
  const result = await callRewardModel(prompt, "quality", model);
  return { ...result, output: ScoreOutputSchema.parse(result.output), answers: undefined };
}

let misses = 0;
let errors = 0;
let costMicroUsd = 0;
const rows: Record<string, unknown>[] = [];
for (const c of cases) {
  const task = tasks[c.task];
  if (!task) throw new Error(`case ${c.id}: unknown task ${c.task}`);
  for (const version of (values.versions ?? "").split(",")) {
    for (let run = 0; run < runs; run++) {
      const row = { case: c.id, version, run, kind: c.kind, expect: c.expect };
      lastResponse = undefined;
      try {
        const s = await score(version, {
          rubric,
          task,
          contribution: { kind: c.kind, text: c.text },
        });
        costMicroUsd += s.costMicroUsd;
        const out = s.output;
        const credited = creditedScore(out);
        const ok = judge(c.expect, credited);
        if (!ok) misses++;
        const yes = Object.entries(s.answers ?? {})
          .filter(([, a]) => a)
          .map(([id]) => id);
        rows.push({
          ...row,
          raw: out.score,
          credited,
          flags: out.flags,
          ok,
          latencyMs: s.latencyMs,
          costMicroUsd: s.costMicroUsd,
          ...(s.answers && { answers: s.answers }),
        });
        console.log(
          `${c.id.padEnd(30)} ${version} raw ${String(out.score).padStart(3)} credited ${String(credited).padStart(3)} ${out.flags.join("+").padEnd(34)} ${s.answers ? `yes: ${yes.join(",").padEnd(40)} ` : ""}${ok ? "ok" : "MISS"}`,
        );
      } catch (error) {
        errors++;
        const message = (error as Error).message.split("\n")[0] ?? "";
        const paid = CLAUDE_REGISTRY.get(version)?.costOf?.(lastResponse) ?? 0;
        costMicroUsd += paid;
        rows.push({ ...row, error: message, costMicroUsd: paid });
        console.log(`${c.id.padEnd(30)} ${version} ERROR ${message.slice(0, 60)}`);
      }
    }
  }
}
const summary = { versions: values.versions, rubricVersion: rubric.version, runs, misses, errors };
console.error(JSON.stringify({ misses, errors, costUsd: costMicroUsd / 1e6 }));
if (values.out) {
  await writeFile(
    values.out,
    `${JSON.stringify({ ...summary, costUsd: costMicroUsd / 1e6, rows }, null, 2)}\n`,
  );
}
process.exitCode = exitCode({ misses, errors });
