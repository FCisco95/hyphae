import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isMainModule, isPnpmEntrypoint, pnpmInvocation } from "./process-tools.mjs";

test("native extensionless POSIX pnpm runs directly", {
  skip: process.platform === "win32",
}, () => {
  assert.deepEqual(pnpmInvocation(["install"], { cliPath: "/opt/pnpm" }), {
    command: "/opt/pnpm",
    args: ["install"],
    shell: false,
  });
});
test("npm_execpath matching uses the basename, not an enclosing pnpm-named folder", () => {
  assert.equal(isPnpmEntrypoint("/projects/pnpm-adopter/node_modules/npm/bin/npm-cli.js"), false);
  assert.equal(isPnpmEntrypoint("/node_modules/corepack/dist/pnpm.js"), true);
  assert.equal(isPnpmEntrypoint("C:\\Program Files\\pnpm\\bin\\pnpm.cjs"), true);
});

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

test("PATH resolution finds an actual extensionless POSIX executable", {
  skip: process.platform === "win32",
}, () => {
  const root = mkdtempSync(join(tmpdir(), "hyphae-native-pnpm-"));
  try {
    symlinkSync("/bin/echo", join(root, "pnpm"));
    const code = `import { pnpmInvocation } from ${JSON.stringify(new URL("./process-tools.mjs", import.meta.url).href)}; console.log(JSON.stringify(pnpmInvocation(["native-probe"])));`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      env: { ...process.env, PATH: root, npm_execpath: "/projects/pnpm-adopter/npm-cli.js" },
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    const invocation = JSON.parse(result.stdout);
    assert.equal(invocation.command, realpathSync("/bin/echo"));
    const probe = spawnSync(invocation.command, invocation.args, {
      encoding: "utf8",
      shell: invocation.shell,
    });
    assert.equal(probe.stdout.trim(), "native-probe");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
