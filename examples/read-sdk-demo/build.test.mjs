import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { installDemoDependencies } from "./build.mjs";

test("actual pnpm installs the packed SDK in a spaced/special-character consumer path", () => {
  const root = mkdtempSync(join(tmpdir(), "Hyphae First Last # % ü "));
  const consumer = join(root, "consumer # % é");
  mkdirSync(consumer);
  const originalArchive = fileURLToPath(
    new URL("../../packages/read-client/dist/hyphae-read-client-0.1.0.tgz", import.meta.url),
  );
  const archive = join(root, "SDK archive # % ü.tgz");
  copyFileSync(originalArchive, archive);
  try {
    installDemoDependencies(archive, consumer);
    const manifest = JSON.parse(readFileSync(join(consumer, "package.json"), "utf8"));
    assert.equal(manifest.dependencies["@hyphae/read-client"], "file:./sdk.tgz");
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import { createHyphaeReadClient } from '@hyphae/read-client'; if (typeof createHyphaeReadClient !== 'function') process.exit(1);",
      ],
      { cwd: consumer, encoding: "utf8", timeout: 10_000 },
    );
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
