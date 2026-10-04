---
type: review
project: hyphae
summary: "Fresh fix check NEEDS FIXES at 33561849..010c68cf: one Medium tarball-path regression, two Low helper/timer issues; accepted SDK unchanged."
updated: 2026-10-04
---

# Focused review: 335618498ad4bb65ce9fac6ca4353ae6852816c6..010c68cfe32fd9db98fcf95e3eb273c05be4edee
Reviewer: Claude Opus 5.5 (claude-opus-5-5), low effort. Read-only. Verdict: **NEEDS FIXES** (1 Medium, 2 Low, 1 nit).

## Findings
1. MEDIUM examples/read-sdk-demo/build.mjs:34. Dependency spec `pathToFileURL(archive).href` percent-encodes the path, and pnpm 10.29.3 does not decode `file:` specs (fromLocal only strips `file:` and slashes, pnpm.cjs:55756). A checkout at `/Users/First Last/hyphae` or `C:\Users\First Last\hyphae` makes the spec `.../First%20Last/...`, so pnpm looks for a file that doesn't exist and install fails. Same for `#`, `%` and non-ASCII paths. The old `file:${archive}` worked on POSIX paths with spaces, so this is a regression, and it contradicts the handoff's claim that spaces are handled. The tests cover only argv and the main-module URL, not this spec. Simulated with pnpm's own regex: spaced paths fail the round trip, plain paths pass. Fix: copy the tgz into the consumer and depend on `file:./hyphae-read-client.tgz`, or use `file:${archive}` (pnpm already normalizes backslashes and drive letters). Add a unit test with a spaced path.
2. LOW examples/read-sdk-demo/process-tools.mjs:7-27. (a) Only `.cjs/.mjs/.js/.exe` real paths are accepted. A standalone native pnpm on macOS/Linux (get.pnpm.io install.sh / @pnpm/exe, extensionless binary) can never resolve, so `node run.mjs` fails with "Cannot resolve pnpm". Fix: on non-win32, accept an executable regular file with no extension and spawn it directly with shell:false; or state this in the README. (b) `npm_execpath.includes("pnpm")` matches the whole path, so `/x/pnpm-tools/npm/bin/npm-cli.js` would run npm with pnpm args. Fix: test the basename. No command or shell injection found: every arg is passed separately with shell:false, .cmd/.bat are refused, and there is no fallback to a PATH-searched "pnpm".
3. LOW examples/read-sdk-demo/app.js:115-121. The cooldown re-enable runs on a single setTimeout(retryAfter) that calls syncControls once. If the timer fires a hair before Date.now() reaches retryUntil (timer and wall clock drift or coarsening), all three controls stay disabled and nothing re-checks. Fix: in the callback, reschedule while Date.now() < retryUntil, or add a small margin (retryUntil - Date.now() + 50).
4. NIT process-tools.mjs:41-48. isMainModule doesn't realpath argv[1], while import.meta.url is realpath'd. A server started through a symlinked dist path (e.g. /tmp on macOS) silently does nothing. This was already true before this delta.

## Verified OK
- Install uses prefer-offline, ignore-scripts, fetch-retries=1, fetch-timeout 20 s and a spawnSync timeout of 120 s. The store and cache dirs are optional, and verify --empty-store removes them in finally.
- Cooldown: one `retryUntil` value drives all three disabled states. load() and bootstrap() both return early during cooldown, so synthetic change/click events make no requests. No automatic retry; recovery is a deliberate click.
- Bootstrap: 2 s abort, no-store cache mode, checks `ok`, and validates the fixture flag, a non-empty list, the mint pattern and string names (rendered with textContent). The catch clears busy and shows Unavailable. finally resets `booting`. Read again calls bootstrap() while unconfigured.
- process-tools is copied into dist, and server.mjs uses only isMainModule. findPnpm is a lazy default parameter, so importing the module runs no PATH probing.
- Server is unchanged apart from the main-module guard: 127.0.0.1 only, GET only, a fixed three-file map, no credentials.
- The dead AbortSignal.timeout spy is removed and the starter suite still passes. packages/, programs/, apps/api/src and pnpm-lock.yaml are unchanged in the range.

## Checks now vs prior
Now: `node --test process-tools.test.mjs` 3/3 pass; starter vitest 14/14 pass; `node --check app.js` OK; pnpm file-spec regex simulation (above); git diff shows the SDK, core, lock and API unchanged.
Prior, not rerun: 891/1skip, types 0, lint 308, browser regressions, empty-store full Chromium flow, mobile and keyboard.
Limitations: no install, build or browser run (read-only scope). Native Windows execution is UNKNOWN, and Windows-shaped unit tests on a Mac do not prove it.
