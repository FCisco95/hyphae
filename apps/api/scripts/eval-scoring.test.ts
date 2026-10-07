import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
function evalScoring(args: string[], env: Record<string, string>, preload?: string) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      ...(preload ? ["--import", preload] : []),
      "scripts/eval-scoring.ts",
      ...args,
    ],
    {
      cwd: new URL("../", import.meta.url),
      encoding: "utf8",
      env: { ...process.env, ...env },
      timeout: 25_000,
    },
  );
}

it.each([
  ["--recorded", "recording.json"],
  ["--record", "recording.json"],
  ["--questions", "v3-2026-09-30"],
  ["--backend", "sonnet", "--recorded", "recording.json"],
  ["--backend", "sonnet", "--record", "recording.json"],
  ["--backend", "sonnet", "--questions", "v3-2026-09-30"],
  ["--backend", "jev", "--recorded", "input.json", "--record", "output.json"],
  ["--backend", "jev", "--recorded", ""],
])(
  "rejects incompatible eval options before any provider call: %j",
  { timeout: 30_000 },
  (...args) => {
    const dir = mkdtempSync(join(tmpdir(), "hyphae-eval-"));
    try {
      const calls = join(dir, "provider-calls");
      // Intercept the real providers' network boundary; even a regression cannot spend money.
      const preload = `data:text/javascript,${encodeURIComponent(
        `import { appendFileSync } from 'node:fs'; globalThis.fetch = async () => { appendFileSync(${JSON.stringify(calls)}, 'call\\n'); throw new Error('network disabled in eval test'); };`,
      )}`;
      const result = evalScoring(
        [
          "--cases",
          "../../docs/rubrics/eval/mycel-synthetic.json",
          "--rubric",
          "../../docs/rubrics/mycel-1.2.0.json",
          ...args,
        ],
        { ANTHROPIC_API_KEY: "test-only", TYPESAFE_API_KEY: "test-only", DEEPSEEK_API_KEY: "" },
        preload,
      );
      expect(result.status).not.toBe(0);
      expect(existsSync(calls)).toBe(false);
      expect(result.stderr).toMatch(
        /eval-scoring:.*(requires --backend jev|mutually exclusive|must not be empty)/,
      );
      expect(result.stdout).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

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
    mode: "live",
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
    expect(JSON.parse(result.stderr)).toEqual({
      passed: 1,
      total: 1,
      errored: 0,
      costMicroUsd: 84,
    });
    expect(JSON.parse(result.stdout)).toMatchObject({
      id: "example-only",
      raw: 85,
      credited: 85,
      passed: true,
      run: {
        model: "jev-1.13.0",
        questionSet: "v3-2026-09-30",
        latencyMs: 140,
        mode: "replay",
        metricsSource: "recorded-call",
        rubricVersion: "1.2.0",
        configurationHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        composition: { weights: { quality: 0.5, criteria: 0.5 }, threshold: 0.5 },
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("counts a case whose scoring throws as a failure and scores the rest", {
  timeout: 30_000,
}, async () => {
  const [example] = EvalCasesSchema.parse(JSON.parse(documentedFixture()));
  if (!example) throw new Error("documented fixture is empty");
  const rubric = RubricSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../docs/rubrics/mycel-1.2.0.json", import.meta.url), "utf8"),
    ),
  );
  const live = recordingJev(async (request) => ({
    latencyMs: 10,
    mode: "live",
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
      usage: JSON.stringify(request.state).includes("Third reply.")
        ? "not a usage record"
        : { input_tokens: 1000, output_tokens: 10 },
    },
  }));
  const { task, contribution } = example;
  await runJev({ rubric, task, contribution }, DEFAULT_QUESTION_SET, live.backend);
  // The third case's recorded answer breaks the schema, so replaying it throws a multi-line
  // validation error whose first line is only "[".
  const broken = {
    ...example,
    id: "broken-usage",
    contribution: { ...contribution, text: "Third reply." },
  };
  await runJev(
    { rubric, task, contribution: broken.contribution },
    DEFAULT_QUESTION_SET,
    live.backend,
  ).catch(() => undefined);
  // The second case was never recorded, so replaying it throws.
  const unrecorded = {
    ...example,
    id: "never-recorded",
    contribution: { ...contribution, text: "Another reply." },
  };
  const dir = mkdtempSync(join(tmpdir(), "hyphae-eval-"));
  try {
    const cases = join(dir, "cases.json");
    const recording = join(dir, "recording.json");
    writeFileSync(cases, JSON.stringify([example, unrecorded, broken]));
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
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ passed: 1, total: 3, errored: 2 });
    const lines = result.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ id: example.id, passed: true });
    expect(lines[1]).toMatchObject({
      id: "never-recorded",
      passed: false,
      runError: expect.stringMatching(/no recorded Jev answer/),
    });
    // The whole message survives, not just its first line.
    expect(lines[2]).toMatchObject({
      id: "broken-usage",
      passed: false,
      runError: expect.stringMatching(/usage/),
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
