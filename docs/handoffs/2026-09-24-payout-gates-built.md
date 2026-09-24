---
date: 2026-09-24
summary: The rules test, the payout gate and the hold gate, scoped, planned and built test-first on the ruled payment definitions (P9, P12, P14, P16). Built and tested locally, not deployed. Migration 0009 is written and tested on PGlite and Postgres 17, not applied to Neon. /rules runs the six-question quiz in a private chat and records a 6/6 pass. evaluatePayoutGate decides, fail-closed, whether a closed epoch may be allocated and who is payable. runHoldChecks runs the Sentinel SDK's checkHold once per candidate after a paid epoch closes, and the worker retries uncertain results every five minutes. A Postgres test on the production driver caught a bug that PGlite hid. Codex reviewed it in five fresh rounds. Eleven code findings were fixed test-first. One, whether "held at the close" can mean the first read after it, is parked as a policy question for Cisco; Codex agreed it is policy, not a code defect.
---

# 2026-09-24 — rules test, payout gate and hold gate (local)

## Authority

- The arc is Cisco's next action 5 in `docs/HANDOFF.md` ("rules-test scope proposal and hold-gate plan, build both by Oct 1"), restated as this session's prompt, which pre-approved the arc. It stops before deploy, Fly, Vercel, Neon and secrets.
- Rulings built on: P9 (payable member), P10 (reasons), P12 (epoch 2 first paid), P14 (display), P16 (hold result recorded) in `2026-09-24-contract-and-payment-rulings.md`.
- Specs written this session: `2026-09-26-rules-test-scope-proposal.md` (RT1–RT6, PG1–PG9) and `2026-09-26-hold-gate-plan.md` (hold gate and the seven-task build).
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), effort xhigh, Windows. The session prompt preferred Fable 5.1; this session ran on Opus 5.5.

## What was built

| Piece | Where |
|---|---|
| Migration 0009: `communities.first_paid_epoch`, `rules_test_passes`, `hold_check_status`, `hold_checks` (additive) | `packages/db/src/schema.ts`, `packages/db/drizzle/0009_payout_gates.sql` |
| The MYCEL rules test (six questions for rubric 1.2.0, as proposed in RT2), grading, pass records | `apps/api/src/payout/rules-test.ts` |
| `/rules` in the group, `/start rules_<id>` and the answer buttons in a private chat | `apps/api/src/bot/commands/rules.ts`, `bot/index.ts` |
| The payout gate: epoch checks 1–9, member checks M1–M4, fail-closed | `apps/api/src/payout/gate.ts` |
| The hold gate: `holdCheckerFromEnv`, `runHoldChecks`, `dueHoldChecks` | `apps/api/src/payout/hold-gate.ts` |
| Worker: `hold-check` queue, close hook, recovery sweep, `HOLD_RPC_HELIUS_URL` / `HOLD_RPC_FALLBACK_URL` | `apps/api/src/jobs/{queue,reward-jobs}.ts`, `worker.ts`, `env.ts` |
| The gates on Postgres 17 through postgres-js | `apps/api/src/payout/gates.pg.test.ts` |

## Deviations, and why

1. **"Rules test" names two things.** The session prompt described a payout preflight. The approved policy and P9 mean a member quiz. Both are needed, so both were built under separate names: the rules test (quiz) and the payout gate (preflight). The scope proposal explains the split.
2. **`packages/db` was written, outside the prompt's writable paths.** Both gates must record what they decide: passes, hold results and the first paid epoch. The prompt's rule for a needed migration was "note it, don't apply it". 0009 is written, tested on PGlite and Postgres 17 in Docker, and **not applied to Neon**. Reverting it is one commit (`5fb2aa5`).
3. **The questions are code, not a `docs/rubrics` JSON file.** `.dockerignore` excludes `docs/`, so the api image could not import them from there.
4. **The read API and the site are unchanged.** P14 keeps the allocation section `unavailable` until publish, and publish cannot run while any member is held. So "shown as held" is the gate's per-member `held` status and epoch blocker `hold_checks_pending`. The site's existing panel reads "Not allocated. No payout exists for this epoch.", so it never says paid. R6 wires P14's section, with the reason `awaiting_hold_checks` (plan, "What a held claim shows"). `apps/web` was outside this arc's writable paths.
5. **A pre-existing test got a 30 s timeout** (`read-service.test.ts`, "never lock a row"). It migrates a fresh PGlite inside the test. With 0009 and the new test files, `pnpm -r test` pushed it past 5 s in two of three runs (5.4 s, 5.7 s). Its assertion is about lock clauses, not speed; the 0008 backfill test already had the same timeout.
6. **The 0008 backfill test seeds with raw SQL.** It migrates to 0007, and today's schema has a column that 0007 does not.
7. **Added beyond the plan:** `gates.pg.test.ts`. It found a real bug (next section).
8. **Beyond the plan, from review:** the 24-hour hold window (PG10), the mainnet genesis check, and the per-read row claim (`FOR UPDATE SKIP LOCKED`, a transaction held across one provider read). The plan and the scope proposal were updated to match.
9. **Two looping gate tests became `it.each`** (`e2e8656`). One seeded six demo epochs inside a single test and passed the 5 s budget once under load (5.3 s).

## Evidence

- Gate on `e2e8656`: `pnpm -r test` exit 0 three runs in a row (core 67, web 14, api 372); `pnpm -r typecheck` exit 0; Biome on tracked files exit 0 (179 files); `drizzle-kit check` exit 0; `test:pg` 15/15 on Postgres 17 in Docker; `git diff --check` exit 0.
- **A bug that PGlite hid:** `dueHoldChecks` passed a JavaScript `Date` into a raw `sql` template. PGlite accepted it; postgres-js, the production driver, throws. The call sits in the five-minute recovery sweep, so every sweep would have failed, and with it the re-sends of stranded evaluations, notifications and closes. The Postgres test failed on it; the query now uses column-typed operators (`aab7130`).
- **Found by the new Postgres test, not by review:** the raw `Date` in `dueHoldChecks` (below). Found by Biome: a test helper named `after` read as a mocha hook (`11f42d8`).
- **Mutation probes**, each run against the finished code, then restored:
  - rules test and bot: recording a pass regardless of grade, and accepting taps outside a private chat. Both were caught.
  - payout gate: nine probes. Treating uncertain as below, skipping the snapshot check, accepting any wallet link method, ignoring the hold row's wallet, reporting nobody payable while someone is held, dropping the duplicate-wallet check, paying when the first paid epoch is null, and accepting a late decision flagged as affecting the allocation were all caught. One survived: an `excluded` entry with no decision at all. A test was added for it and now catches it.
  - hold gate: six probes. Overwriting a confirmed result, a new check round per retry, checking non-candidates, ignoring a mismatched stored check, dropping the 7-day first-check window, and hiding "not configured" were all caught. The window was probed again after the rewrite, and caught.
- **The real SDK** runs in the hold tests behind a fake JSON-RPC `fetch`, covering guide §7's hold-gate cases. Agreement at or above the threshold gives holder. Below gives below. Disagreement, an outage on either provider, a stale block time and a malformed body give uncertain. A missing or `http:` URL gives not configured, with no request. The same host twice, or a Helius fallback, gives uncertain. An invalid address gives uncertain, not an exception.
- **Site agreement:** for every member of the demo's closed epoch, the gate's points equal the leaderboard's. The gate's `no_verified_wallet` holds exactly when the read API says `wallet_status ≠ verified`.
- **Test-first, stated plainly:** each new module's tests were written first and failed because the module did not exist. The worker wiring test failed on its assertions. The `dueHoldChecks` driver bug failed on Postgres before the fix. Because a missing module is a weak red, the mutation probes above are the evidence that the tests test the behaviour.

## Review (cross-model, before push)

Five fresh Codex sessions (`codex-cli` via the companion, `task --fresh --effort xhigh`, read-only; the diff and specs were passed as a prompt file because its sandbox cannot read the workspace). Every fix was test-first.

| Round | Scope | Verdict | Findings and what happened |
|---|---|---|---|
| 1 | `1b46b33..aab7130`, with the ruled P-rows, guide §6 and both specs | needs-attention | **F1 high:** a hold read days after the close still counted. Fixed with a 24-hour window after `closes_at` (PG10) in the gate, the runner and the due query (`c228839`). **F2 high:** the providers' network was never attested. Fixed: both must return mainnet's genesis hash (`8970974`). **F3 medium:** a quiz tap could name another community's test. Fixed: only the current test is accepted (`42ec32d`). **F4 low:** a millisecond `passed_at` rounded a pass onto the cutoff. Fixed with microseconds, and 0009 amended in place since it is unapplied (`c91f253`). |
| 2 | `aab7130..a072ccb` | needs-attention | F2–F4 resolved. **H1 high:** a member can buy right after the close and be read inside the window. There is no code fix: no RPC reads a past balance. **Parked as a policy question** (Q6). **M1 medium:** the genesis reply wasn't validated as JSON-RPC. **M2 medium:** the clock was sampled once, so a late answer could stand as final. **L1 low:** the due query's boundary was exclusive. All three fixed (`1cd49c6`). |
| 3 | `c228839..1cd49c6`, with the H1 rationale | needs-attention | M1, M2 and L1 resolved. **H1 judged "correctly parked as a policy decision".** **Medium:** two concurrent runs could both read one row. Fixed with a per-read `FOR UPDATE SKIP LOCKED` claim; the Postgres test runs six runners and gets one read. **Low:** a pre-close observation stood as final. Fixed: `too_early` and `before_close` (`208fb96`). |
| 4 | `1cd49c6..208fb96` | needs-attention | Both resolved, and no lock cycle or driver issue. **Low:** the window check came before the pooled connection. Fixed: checked again after the claim (`f47d731`). |
| 5 | `208fb96..f47d731` | needs-attention | The pool-wait low is resolved. **Low:** the checker's first-use genesis step could push a balance read past the deadline. It is fixed as far as this code reaches: the runner passes the deadline and the checker checks it again after the genesis step (`631c229`). Residual: the SDK's two reads cannot be interrupted once started (4 s each, one retry), and an answer that lands late is recorded as uncertain. This fix was not sent for a sixth review; it cannot make anyone payable. |


## Not done, parked

- **Deploy steps (Cisco, attended, one per message):** answer RT2 first (the questions go live with the deploy), apply 0009 on Neon, `fly secrets set HOLD_RPC_HELIUS_URL=… HOLD_RPC_FALLBACK_URL=…`, deploy, and after the Oct 1 go/no-go, `update communities set first_paid_epoch = 2 where mint = '<MYCEL mint>' and first_paid_epoch is null;`.
- **R6** reads the gate: allocation, cap, fee and dust, manifests with the hold observation, P14's section and reasons.
- `docs/TESTING.md` still lists the rules test and hold check as planned. That stays true until the deploy, and the announcement waits for it.
