import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { HOOKS_PATH, sessionCheck } from "./session-check.mjs";

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function git(repo, ...args) {
  return execFileSync(
    "git",
    ["-C", repo, "-c", "user.name=test", "-c", "user.email=test@example.com", ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

function commit(repo, file, text = file) {
  writeFileSync(join(repo, file), text);
  git(repo, "add", file);
  git(repo, "commit", "--quiet", "-m", file);
}

// A bare origin with one commit on main, and two clones of it ("machines").
function setup() {
  const root = mkdtempSync(join(tmpdir(), "session-check-"));
  roots.push(root);
  const origin = join(root, "origin.git");
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origin]);
  const a = join(root, "a");
  const b = join(root, "b");
  execFileSync("git", ["clone", "--quiet", origin, a], { stdio: "ignore" });
  git(a, "checkout", "--quiet", "-b", "main");
  commit(a, "README.md");
  git(a, "push", "--quiet", "-u", "origin", "main");
  execFileSync("git", ["clone", "--quiet", origin, b], { stdio: "ignore" });
  return { root, a, b };
}

test("a clean main equal to origin passes", () => {
  const { a } = setup();
  const result = sessionCheck(a, { mode: "end" });
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
});

test("start fast-forwards a clean main that is behind origin", () => {
  const { a, b } = setup();
  commit(b, "from-b.md");
  git(b, "push", "--quiet", "origin", "main");

  assert.match(sessionCheck(a, { mode: "end" }).problems.join(), /1 commit\(s\) behind/);

  const result = sessionCheck(a, { mode: "start" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.actions, ["fast-forwarded main by 1 commit(s)"]);
  assert.equal(git(a, "rev-parse", "main"), git(b, "rev-parse", "main"));
});

test("start does not fast-forward a dirty tree", () => {
  const { a, b } = setup();
  commit(b, "from-b.md");
  git(b, "push", "--quiet", "origin", "main");
  writeFileSync(join(a, "README.md"), "edited");

  const result = sessionCheck(a, { mode: "start" });
  assert.equal(result.ok, false);
  assert.deepEqual(result.actions, []);
  assert.match(result.problems.join("\n"), /1 uncommitted change/);
  assert.match(result.problems.join("\n"), /behind origin\/main/);
});

test("unpushed and diverged main fail", () => {
  const { a, b } = setup();
  commit(a, "local.md");
  assert.match(sessionCheck(a).problems.join(), /1 unpushed commit\(s\) on main/);

  commit(b, "from-b.md");
  git(b, "push", "--quiet", "origin", "main");
  const result = sessionCheck(a, { mode: "start" });
  assert.match(result.problems.join(), /diverged \(1 ahead, 1 behind\)/);
  assert.deepEqual(result.actions, []);
});

test("another branch fails while it holds unique commits and is only a note once merged", () => {
  const { a } = setup();
  git(a, "checkout", "--quiet", "-b", "side");
  commit(a, "side.md");
  git(a, "push", "--quiet", "origin", "side");
  git(a, "checkout", "--quiet", "main");

  const problems = sessionCheck(a).problems.join("\n");
  assert.match(problems, /local branch side has 1 commit\(s\) not in origin\/main/);
  assert.match(problems, /origin\/side has 1 commit\(s\) not in origin\/main/);

  git(a, "merge", "--quiet", "--ff-only", "side");
  git(a, "push", "--quiet", "origin", "main");
  const merged = sessionCheck(a);
  assert.equal(merged.ok, true);
  assert.match(merged.notes.join("\n"), /local branch side is fully in origin\/main/);
  assert.match(merged.notes.join("\n"), /origin\/side is fully in origin\/main/);
});

test("being on another branch, an extra worktree and a stash all fail", () => {
  const { root, a } = setup();
  git(a, "worktree", "add", "--quiet", "--detach", join(root, "wt"));
  writeFileSync(join(a, "README.md"), "stashed");
  git(a, "stash", "--quiet");
  git(a, "checkout", "--quiet", "--detach");

  const problems = sessionCheck(a).problems.join("\n");
  assert.match(problems, /on "HEAD", not main/);
  assert.match(problems, /1 extra worktree/);
  assert.match(problems, /1 stash/);
});

test("start points git at the committed hooks", () => {
  const { a } = setup();
  mkdirSync(join(a, HOOKS_PATH));
  commit(a, `${HOOKS_PATH}/pre-push`, "#!/bin/sh\n");
  git(a, "push", "--quiet", "origin", "main");

  assert.deepEqual(sessionCheck(a, { mode: "start" }).actions, [
    `set core.hooksPath to ${HOOKS_PATH} (pre-push gate)`,
  ]);
  assert.equal(git(a, "config", "--local", "core.hooksPath"), HOOKS_PATH);
  assert.deepEqual(sessionCheck(a, { mode: "start" }).actions, []);
});
