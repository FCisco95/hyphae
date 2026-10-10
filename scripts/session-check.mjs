// Session check for the one-branch workflow in AGENTS.md. Pure git, no network beyond `git fetch`.
//
//   node scripts/session-check.mjs start   # fetch, fast-forward a clean `main`, then check
//   node scripts/session-check.mjs end     # fetch, then check (nothing is changed)
//   flags: --offline (skip the fetch), --hook (SessionStart JSON, always exit 0)
//
// It fails (exit 1) when work could be stranded on one machine: not on `main`, a dirty tree,
// `main` not equal to `origin/main`, another branch (local or on origin) with commits that are not
// in `origin/main`, an extra worktree, or a stash. It never deletes, resets, stashes or pushes.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = "main";
const UPSTREAM = `origin/${MAIN}`;
export const HOOKS_PATH = ".githooks";

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function lines(text) {
  return text.split("\n").filter(Boolean);
}

function hasRef(repo, ref) {
  try {
    git(repo, ["rev-parse", "--verify", "--quiet", ref]);
    return true;
  } catch {
    return false;
  }
}

function uniqueCount(repo, ref) {
  return Number(git(repo, ["rev-list", "--count", `${UPSTREAM}..${ref}`]));
}

export function sessionCheck(repo = REPO, { mode = "end", offline = false } = {}) {
  const problems = [];
  const notes = [];
  const actions = [];

  if (!offline) {
    try {
      git(repo, ["fetch", "--quiet", "--prune", "origin"]);
    } catch {
      notes.push("git fetch failed (offline or auth); origin state below may be stale");
    }
  }
  if (!hasRef(repo, UPSTREAM)) {
    return { ok: false, problems: [`${UPSTREAM} not found`], notes, actions };
  }

  // The pre-push gate only runs when git is pointed at the committed hooks; doing it here means
  // every machine picks it up at its first session.
  if (mode === "start" && hasHooksDir(repo)) {
    let current = "";
    try {
      current = git(repo, ["config", "--local", "core.hooksPath"]);
    } catch {}
    if (current !== HOOKS_PATH) {
      git(repo, ["config", "--local", "core.hooksPath", HOOKS_PATH]);
      actions.push(`set core.hooksPath to ${HOOKS_PATH} (pre-push gate)`);
    }
  }

  const branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const dirty = lines(git(repo, ["status", "--porcelain"])).length;
  if (branch !== MAIN) problems.push(`on "${branch}", not ${MAIN}`);
  if (dirty > 0) problems.push(`${dirty} uncommitted change(s)`);

  if (hasRef(repo, `refs/heads/${MAIN}`)) {
    let [behind, ahead] = git(repo, [
      "rev-list",
      "--left-right",
      "--count",
      `${UPSTREAM}...${MAIN}`,
    ])
      .split(/\s+/)
      .map(Number);
    if (mode === "start" && branch === MAIN && dirty === 0 && ahead === 0 && behind > 0) {
      git(repo, ["merge", "--ff-only", "--quiet", UPSTREAM]);
      actions.push(`fast-forwarded ${MAIN} by ${behind} commit(s)`);
      behind = 0;
    }
    if (ahead > 0 && behind > 0) {
      problems.push(`${MAIN} and ${UPSTREAM} diverged (${ahead} ahead, ${behind} behind)`);
    } else if (ahead > 0) {
      problems.push(`${ahead} unpushed commit(s) on ${MAIN}`);
    } else if (behind > 0) {
      problems.push(`${MAIN} is ${behind} commit(s) behind ${UPSTREAM}; pull before working`);
    }
  } else {
    problems.push(`no local ${MAIN} branch`);
  }

  const skip = [`refs/heads/${MAIN}`, `refs/remotes/${UPSTREAM}`, "refs/remotes/origin/HEAD"];
  for (const ref of lines(
    git(repo, ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes/origin"]),
  )) {
    if (skip.includes(ref)) continue;
    const name = ref.startsWith("refs/heads/")
      ? `local branch ${ref.slice("refs/heads/".length)}`
      : ref.slice("refs/remotes/".length);
    const unique = uniqueCount(repo, ref);
    if (unique > 0) problems.push(`${name} has ${unique} commit(s) not in ${UPSTREAM}`);
    else notes.push(`${name} is fully in ${UPSTREAM}; delete it`);
  }

  const worktrees = lines(git(repo, ["worktree", "list", "--porcelain"])).filter((line) =>
    line.startsWith("worktree "),
  );
  if (worktrees.length > 1) {
    problems.push(
      `${worktrees.length - 1} extra worktree(s): ${worktrees
        .slice(1)
        .map((line) => line.slice("worktree ".length))
        .join(", ")}`,
    );
  }

  const stashes = lines(git(repo, ["stash", "list"])).length;
  if (stashes > 0) problems.push(`${stashes} stash(es)`);

  return { ok: problems.length === 0, problems, notes, actions };
}

function hasHooksDir(repo) {
  try {
    return git(repo, ["ls-files", HOOKS_PATH]).length > 0;
  } catch {
    return false;
  }
}

export function render({ ok, problems, notes, actions }, mode) {
  const out = [`hyphae session check (${mode}): ${ok ? "OK" : "NOT OK"}`];
  for (const action of actions) out.push(`  did:  ${action}`);
  for (const problem of problems) out.push(`  FAIL: ${problem}`);
  for (const note of notes) out.push(`  note: ${note}`);
  if (!ok) {
    out.push(
      "  Fix these before working (start) or before stopping (end); see AGENTS.md. Never delete",
      "  work that exists nowhere else: ask Cisco.",
    );
  }
  return out.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args.includes("start") ? "start" : "end";
  let result;
  try {
    result = sessionCheck(REPO, { mode, offline: args.includes("--offline") });
  } catch (error) {
    result = { ok: false, problems: [`check crashed: ${error.message}`], notes: [], actions: [] };
  }
  const text = render(result, mode);
  if (args.includes("--hook")) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text },
      }),
    );
  } else {
    console.log(text);
    process.exitCode = result.ok ? 0 : 1;
  }
}
