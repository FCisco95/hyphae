import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RubricSchema } from "@hyphae/core";
import { expect, it } from "vitest";
import { EvalCasesSchema } from "../src/scoring/eval.js";
import { JEV_MODEL, recordingJev, runJev } from "../src/scoring/jev.js";
import { DEFAULT_QUESTION_SET } from "../src/scoring/jev-questions.js";

function documentedFixture(): string {
  const readme = readFileSync(
    new URL("../../../docs/rubrics/eval/README.md", import.meta.url),
    "utf8",
  );
  const example = readme.match(/```json\r?\n([\s\S]*?)\r?\n```/)?.[1];
  if (!example) throw new Error("documented fixture is missing");
  return example;
}

// Boots tsx in a child process: alone it takes under 1 s, but under the full parallel suite it
// once took 8.5 s, past vitest's 5 s default.
function evalScoring(args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/eval-scoring.ts", ...args], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 25_000,
  });
}

it("dry-runs the documented fixture without credentials or model calls", {
  timeout: 30_000,
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "hyphae-eval-"));
  try {
    const cases = join(dir, "cases.json");
    writeFileSync(cases, documentedFixture());
    const result = evalScoring(
      ["--cases", cases, "--rubric", "../../docs/rubrics/mycel-1.2.0.json", "--dry-run"],
      { ANTHROPIC_API_KEY: "", DEEPSEEK_API_KEY: "" },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ cases: 1, rubricVersion: "1.2.0" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("replays a recorded Jev run of the documented fixture without a key", {
  timeout: 30_000,
}, async () => {
  const [example] = EvalCasesSchema.parse(JSON.parse(documentedFixture()));
  if (!example) throw new Error("documented fixture is empty");
  const rubric = RubricSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../docs/rubrics/mycel-1.2.0.json", import.meta.url), "utf8"),
    ),
  );
  // A made-up answer, not a real Jev response: every criterion yes, quality 2.8 of 4, no flags.
  const live = recordingJev(async (request) => ({
    latencyMs: 140,
    response: {
      model: JEV_MODEL,
      answers: Object.fromEntries(
        Object.keys(request.questions).map((id) => [
          id,
          id === "quality"
            ? { type: "score", score: 2.8, confidence: 0.7, probabilities: { "2": 0.2, "3": 0.8 } }
            : { type: "noul", noul: id in DEFAULT_QUESTION_SET.criteria ? 1 : 0 },
        ]),
      ),
      usage: { input_tokens: 2000, output_tokens: 44 },
    },
  }));
  const { task, contribution } = example;
  await runJev({ rubric, task, contribution }, DEFAULT_QUESTION_SET, live.backend);
  const dir = mkdtempSync(join(tmpdir(), "hyphae-eval-"));
  try {
    const cases = join(dir, "cases.json");
    const recording = join(dir, "recording.json");
    writeFileSync(cases, documentedFixture());
    writeFileSync(recording, JSON.stringify(live.recording(DEFAULT_QUESTION_SET)));
    const result = evalScoring(
      [
        "--backend",
        "jev",
        "--cases",
        cases,
        "--rubric",
        "../../docs/rubrics/mycel-1.2.0.json",
        "--recorded",
        recording,
      ],
      { TYPESAFE_API_KEY: "" },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stderr)).toEqual({ passed: 1, total: 1, costMicroUsd: 84 });
    expect(JSON.parse(result.stdout)).toMatchObject({
      id: "example-only",
      raw: 85,
      credited: 85,
      passed: true,
      run: { model: "jev-1.13.0", questionSet: "draft-2026-09-30", latencyMs: 140 },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("refuses a live Jev run without TYPESAFE_API_KEY", { timeout: 30_000 }, () => {
  const result = evalScoring(
    [
      "--backend",
      "jev",
      "--cases",
      "../../docs/rubrics/eval/mycel-synthetic.json",
      "--rubric",
      "../../docs/rubrics/mycel-1.2.0.json",
    ],
    { TYPESAFE_API_KEY: "" },
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/TYPESAFE_API_KEY is not set/);
  expect(result.stdout).toBe("");
});
