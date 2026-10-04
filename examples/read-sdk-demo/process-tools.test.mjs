import assert from "node:assert/strict";
import { test } from "node:test";
import { isMainModule, pnpmInvocation } from "./process-tools.mjs";

test("Windows pnpm and archive paths are individual arguments, without a cmd shell", () => {
  const cliPath = "C:\\Program Files\\pnpm\\bin\\pnpm.cjs";
  const archive = "C:\\SDK & demos\\private file.tgz";
  assert.deepEqual(
    pnpmInvocation(["pack", "--out", archive], {
      cliPath,
      nodePath: "C:\\Program Files\\nodejs\\node.exe",
    }),
    {
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: [cliPath, "pack", "--out", archive],
      shell: false,
    },
  );
});
test("native pnpm.exe is invoked directly and cmd/bat shims are refused", () => {
  assert.equal(
    pnpmInvocation(["install"], { cliPath: "C:\\Tools\\pnpm.exe" }).command,
    "C:\\Tools\\pnpm.exe",
  );
  for (const cliPath of ["C:\\Tools\\pnpm.cmd", "pnpm.bat"])
    assert.throws(() => pnpmInvocation([], { cliPath }));
});
test("main-module detection normalizes Windows drives/spaces/special characters", () => {
  assert.equal(
    isMainModule(
      "file:///C:/Projects/SDK%20%231%25/server.mjs",
      "C:\\Projects\\SDK #1%\\server.mjs",
      true,
    ),
    true,
  );
  assert.equal(
    isMainModule(
      "file:///C:/Projects/SDK%20&%20demo/server.mjs",
      "C:\\Projects\\SDK & demo\\server.mjs",
      true,
    ),
    true,
  );
  assert.equal(
    isMainModule(
      "file:///C:/Projects/SDK%20&%20demo/server.mjs",
      "C:\\Projects\\SDK & demo\\other.mjs",
      true,
    ),
    false,
  );
  assert.equal(
    isMainModule("file:///tmp/SDK%20&%20demo/server.mjs", "/tmp/SDK & demo/server.mjs", false),
    true,
  );
  assert.equal(isMainModule("file:///tmp/server.mjs", undefined), false);
});
