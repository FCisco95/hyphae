import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("dry-runs the documented fixture without credentials or model calls", () => {
  const readme = readFileSync(
    new URL("../../../docs/rubrics/eval/README.md", import.meta.url),
    "utf8",
  );
  const example = readme.match(/```json\r?\n([\s\S]*?)\r?\n```/)?.[1];
  if (!example) throw new Error("documented fixture is missing");
  const dir = mkdtempSync(join(tmpdir(), "hyphae-eval-"));
  try {
    const cases = join(dir, "cases.json");
    writeFileSync(cases, example);
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/eval-scoring.ts",
        "--cases",
        cases,
        "--rubric",
        "../../docs/rubrics/mycel-1.2.0.json",
        "--dry-run",
      ],
      {
        cwd: new URL("../", import.meta.url),
        encoding: "utf8",
        env: { ...process.env, ANTHROPIC_API_KEY: "", DEEPSEEK_API_KEY: "" },
        timeout: 10_000,
      },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ cases: 1, rubricVersion: "1.2.0" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
