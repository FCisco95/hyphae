---
date: 2026-09-26
summary: Hold-gate plan and the build order for both payout gates. After a paid epoch closes, the worker runs the Sentinel SDK's checkHold once for every candidate payable member (points, a signed wallet at close, a rules-test pass). It records the result in hold_checks under a stable checkRound. holder releases the member, below excludes them with below_hold, and uncertain (outage, conflict, stale, invalid response, or missing provider configuration) holds them, which blocks the epoch's publish. The recovery sweep retries every five minutes with the same checkRound until the result is confirmed, for at most 24 hours after the close; only a balance read in that window counts, and both providers must prove they serve mainnet. A confirmed result never changes. A held member is never shown as paid and never dropped. Before publish the whole allocation section is unavailable (P14), and publish cannot run while anyone is held. Seven test-first tasks follow, with migration 0009 written and tested locally only.
---

# Hold-gate plan, and the build order for both gates

> **For agentic workers:** build task by task, test-first (`superpowers:test-driven-development`). Each task ends with its own green run and commit. Global rules: `CLAUDE.md` (comments only for a non-obvious why, no dead code, conventional commits) and the local gate before any push.

**Goal:** make P9's hold condition (P16) and rules-test condition (P9) decidable, recorded and auditable, and give R6 one function that says whether a closed epoch may be allocated and who is payable.

**Architecture:** three modules under `apps/api/src/payout/`. `rules-test.ts` holds the quiz definitions, grading and pass records. `hold-gate.ts` runs and records the hold checks. `gate.ts` is the read-only payout gate, which reads both, the snapshot and the wallet history. There is one bot module (`bot/commands/rules.ts`), one worker queue (`hold-check`) and one additive migration (0009).

**Tech stack:** TypeScript, Drizzle on Postgres (PGlite in tests, Postgres 17 for `test:pg`), grammY, pg-boss, `@organichub/verify` 0.1.0 (`checkHold`, `HeliusBalanceReader`, `FallbackBalanceReader`).

**Spec:** `2026-09-26-rules-test-scope-proposal.md` (RT1–RT6, PG1–PG9), payment rulings P9, P10, P12, P14, P16, and Sentinel consumer guide §6 and §7 "Hold gate" (`FCisco95/mycel-sentinel`, `docs/guides/hyphae-verify-sdk-consumer.md`).

Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), effort xhigh, written 2026-09-24.

## Global constraints

- `checkHold` is evidence only. `uncertain` is never turned into `below` (guide §6).
- Both readers use HTTPS, on different hosts, and the fallback is not Helius. The SDK enforces this and answers `uncertain` (`invalid-response`) otherwise. Hyphae adds "not configured", and checks that both providers serve mainnet (their genesis hash) before believing any balance: another network is `uncertain` (`wrong_network`). The SDK does not attest the network (guide §6).
- A balance counts only if it was observed between `closes_at` and 24 hours after it (PG10). No balance is read after that.
- The threshold is the epoch's **pinned** `rubric.minHoldUnits` (`reward_configs.payload`), never `communities.rubric`. A zero threshold means no hold check and no hold condition (guide §6: "A zero threshold skips the hold check").
- The wallet checked is `walletAt(member, closes_at)` with `method = 'signature'`: the wallet the payout would pay (D3).
- No RPC URL, API key, provider response body or raw error is logged or stored. Logs carry fixed codes and counts only.
- Money never moves in this arc. The gates decide; R6 publishes.

## Review focus

The five failure modes most likely to bite, each pinned by a test in the task that owns the code:

1. **A provider outage or a disagreement during the first check.** The member must stay held, and a later confirmed check must release them. Tests are in Task 5.
2. **A retry after a confirmed result.** A second job run, or a racing duplicate job, must not overwrite `holder` or `below`. Tests are in Task 5.
3. **Provider configuration missing on Fly.** Every candidate must be held (`not_configured`), and nobody may become payable or `below_hold`. Tests are in Task 5.
4. **A snapshot that disagrees with the decisions,** for example a decision inserted behind the close. The gate must block, not pay the stale numbers. Tests are in Task 4.
5. **Forged or stale inline-button data** in the rules test. The bot must never record a pass that does not grade 6/6, and never for another Telegram user. Tests are in Task 3.

---

# Part 1: the hold gate

## What triggers a hold check

| Trigger | When | What it does |
|---|---|---|
| The close hook | `closeRewardEpoch` returns `closed` | Sends one `hold-check` job `{ communityId, epochId }` |
| The recovery sweep | Every 5 minutes (existing `reward-recovery` schedule) | Sends a `hold-check` job for every epoch that `dueHoldChecks` returns |
| The payout gate | Never | It only reads hold results |

`dueHoldChecks(db, now)` returns the epochs that are closed (snapshot exists, `status = 'closed'`), whose community has `first_paid_epoch` set with `index >= first_paid_epoch`, whose `closes_at` is less than 24 hours ago, and that either:

- have a `hold_checks` row still `pending` or `uncertain` (retried every 5 minutes), or
- have no `hold_checks` row yet. This catches a lost close-hook send, and a `first_paid_epoch` set shortly after a close. An epoch with no candidate is re-evaluated every 5 minutes until its window ends, at a cost of a few indexed reads.

A job that runs after the window returns `window_closed` without reading a balance.

A hold-check job for an epoch whose gate stops before the member stage (not final, before the first paid epoch, published, no rules test defined, snapshot mismatch) does nothing and logs the blocker.

## Who is checked

Only **candidates**: members of the snapshot whose only open requirement is the hold. That means exact points > 0, a signed wallet at `closes_at`, and a qualifying rules-test pass (the payout gate's M1–M3). A member who already fails M1–M3 is not payable whatever they hold, so their balance is not read (P16: "every candidate payable member").

## How one check runs

1. The job computes the payout gate for the epoch and takes the members with status `held`.
2. For each, it inserts `hold_checks (epoch_id, member_id, wallet, mint, threshold_raw, check_round = random UUID, status = 'pending')` with `on conflict (epoch_id, member_id) do nothing`. The first insert fixes the `check_round`, and every retry reuses it (the SDK requires one stable UUID per logical check).
3. It selects the epoch's rows with `status in ('pending', 'uncertain')`. A row whose wallet, mint or threshold differs from what the gate computed is an invariant breach and throws. The history is insert-only, so this cannot happen without a bug.
4. For each row it calls `checkHold({ projectId: community id, owner: wallet, mint, thresholdRaw, checkRound, primary, fallback })`.
5. It records the outcome with a conditional update: `… where id = $row and status in ('pending', 'uncertain')`. `holder` and `below` store `raw_amount`, `decimals`, `provider`, `slot` and `observed_at`. `uncertain` stores `reason`. Every attempt increments `attempts` and sets `checked_at = clock_timestamp()`.

Rows are checked one at a time, so a slow provider costs time, not parallel RPC load. Each read and its write happen in one transaction that claims the row with `FOR UPDATE SKIP LOCKED`. A concurrent run (the close hook and the sweep together) skips the row, so each balance is read once, and a crashed run's claim ends with its transaction. A run never starts before `closes_at` (`too_early`), and the window is checked again before every read. An answer observed before `closes_at` is recorded as `uncertain` (`before_close`). An answer that lands after the window is recorded as `uncertain` (`window_closed`), never as `holder` or `below`. The genesis answer counts only as a clean JSON-RPC 2.0 reply to its own request id, without an error. Duplicate jobs are harmless: the row claim lets one run read and write, and a final row is never selected again.

## How a hold clears

| Stored status | Meaning | Gate result | Changes later? |
|---|---|---|---|
| `pending` | Row created, no answer recorded yet | member `held` (`hold_pending`), epoch blocked `hold_checks_pending` | yes, on the next attempt |
| `uncertain` | Last attempt was an outage, a conflict, stale, an invalid response, or not configured | member `held`, epoch blocked | yes, retried by the sweep |
| `holder` | Both providers agree on a balance ≥ threshold | member `payable` (if M1–M3 still hold) | **never** |
| `below` | Both providers agree on a balance < threshold | member `not_payable`, reason `below_hold` | **never** |

"Cleared" means the row reached `holder` (released into the payable set) or `below` (excluded, with the reason shown at publish). The deadline is 24 hours after `closes_at` (PG10). The gate only accepts a confirmed result observed inside that window, because a later read would let a member who bought or sold after the close change the outcome. A member still unconfirmed when the window ends stays held, and the epoch stays blocked, until Cisco rules. He can fix the provider configuration, but nobody can mark a held member `below` (guide §6). `observed_at` and `slot` are stored and go into the member-epoch manifest at publish (P16, B7), so anyone can see how soon after `closes_at` the balance was read.

## What a held claim shows

| Where | Before publish | After publish (R6) |
|---|---|---|
| Audit site, epoch page | "Settlement: Not allocated. No payout exists for this epoch." (today's panel, unchanged). R6 replaces it with P14's section, which stays `unavailable` until publish. Its reason is `awaiting_hold_checks` while the gate reports `hold_checks_pending`. | Publish cannot run while any member is held, so a held member never reaches a published allocation. Every member is then `allocated`/`paid` (P14) or not payable with a P10 reason (`below_hold`, `no_rules_test`, `no_verified_wallet`). |
| Read API `/v1` | `allocation` and `payment` stay `unavailable`. `reason` is an open enum (Part A), so R6 can serve `awaiting_hold_checks` without a v2. | as P14 |
| Payout gate | member `status: "held"`, `reasons: ["hold_pending"]`, epoch `blockers` includes `hold_checks_pending` | — |
| Bot | nothing | R6's publish announcement |

So a held member is **never "paid"** (publish is blocked) and **never silently dropped** (they keep their row, their points and a `held` status in every gate result).

## Provider configuration

- New optional env: `HOLD_RPC_HELIUS_URL` (Helius mainnet, key in the URL) and `HOLD_RPC_FALLBACK_URL` (a non-Helius mainnet provider). Both are secrets, so Cisco sets them on Fly (`fly secrets set`, attended, his step). Recommended fallback: a keyed Alchemy or QuickNode Solana mainnet endpoint. The public `api.mainnet-beta.solana.com` rate-limits `getTokenAccountsByOwner`.
- `holdCheckerFromEnv(env)` builds the two readers once per worker. If either URL is missing, or a reader constructor throws `Invalid RPC configuration`, it returns a checker that answers `{ kind: "uncertain", reason: "not_configured" }` without any network call.
- Before its first balance read, the checker asks both endpoints for `getGenesisHash`. Mainnet (`5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`) on both is remembered for the process. Another network on either answers `uncertain` (`wrong_network`). No usable answer is `uncertain` (`outage`) and is asked again on the next check.
- An owner or mint that is not a valid base58 key (possible only for test and demo data) makes the SDK answer `uncertain` (`invalid-response`). The checker catches the parse error and returns that.

## Deviation from guide §6, on purpose

Guide §6 says to run `checkHold` "before creating a contribution, fetching oEmbed content, scoring, or reserving or spending rewards". Hyphae runs it only before spending rewards: at the snapshot of a paid epoch. P9 and P10 are the community's approved policy. They let a non-holder earn points and show them with `below_hold`, and `docs/TESTING.md` tells testers the hold counts "at the close". The guide defers to that policy ("according to the community's approved policy"). Submission stays open to non-holders. The cost is scoring calls for members who may never be paid, and that cost is unchanged from today.

No hold result is cached across epochs. Each (epoch, member) has one logical check, so the guide's cache rules do not arise.

---

# Part 2: build order

Seven tasks. Tasks 1–4 are the rules test and payout gate (step 3 of the arc), and tasks 5–7 are the hold gate (step 4). Every task starts with a failing test.

## File map

| File | Responsibility |
|---|---|
| `packages/db/src/schema.ts`, `packages/db/drizzle/0009_payout_gates.sql` (+ meta) | `communities.first_paid_epoch`, `rules_test_passes`, `hold_check_status`, `hold_checks` |
| `apps/api/src/payout/rules-test.ts` (+ test) | The six public questions (RT2), test registry and lookup, grading, pass insert, qualifying passes. The questions are code, not a `docs/rubrics` JSON file: `docs/` is excluded from the api's Docker build context. |
| `apps/api/src/bot/commands/rules.ts` (+ test), `apps/api/src/bot/index.ts` | `/rules`, `/start rules_<id>`, answer buttons |
| `apps/api/src/payout/gate.ts` (+ test) | `evaluatePayoutGate` |
| `apps/api/src/payout/hold-gate.ts` (+ test) | `holdCheckerFromEnv`, `runHoldChecks`, `dueHoldChecks` |
| `apps/api/src/jobs/{queue,reward-jobs}.ts` (+ `hold-jobs.test.ts`), `apps/api/src/worker.ts`, `apps/api/src/env.ts` | `hold-check` queue, close hook, sweep, env |
| `apps/api/src/payout/gates.pg.test.ts` | The gates on Postgres 17 through postgres-js, with concurrent hold-check runs and passes (`test:pg`) |

## Task 1: migration 0009

**Files:** `packages/db/src/schema.ts`; generated `packages/db/drizzle/0009_payout_gates.sql` and meta.

**Schema:**

```ts
// communities
firstPaidEpoch: integer("first_paid_epoch"), // null: no epoch of this community is payable yet (P12)
// check: first_paid_epoch is null or >= 1

export const rulesTestPasses = pgTable("rules_test_passes", {
  id, communityId → communities, memberId → members,
  testId: text("test_id").notNull(),
  passedAt: timestamp("passed_at", { withTimezone: true, precision: 3 }).notNull(),
}, (t) => [uniqueIndex("rules_test_passes_member_test").on(t.memberId, t.testId)]);

export const holdCheckStatus = pgEnum("hold_check_status", ["pending", "holder", "below", "uncertain"]);
export const holdChecks = pgTable("hold_checks", {
  id, communityId → communities, epochId → epochs, memberId → members,
  wallet: text().notNull(), mint: text().notNull(),
  thresholdRaw: numeric("threshold_raw", { precision: 20, scale: 0 }).notNull(),
  checkRound: uuid("check_round").notNull(),
  status: holdCheckStatus().notNull().default("pending"),
  reason: text(),                                     // last uncertain reason
  attempts: integer().notNull().default(0),
  rawAmount: numeric("raw_amount", { precision: 20, scale: 0 }),
  decimals: integer(), provider: text(),
  slot: numeric({ precision: 20, scale: 0 }),
  observedAt: timestamp("observed_at", { withTimezone: true, precision: 3 }),
  checkedAt: timestamp("checked_at", { withTimezone: true, precision: 3 }),
  createdAt,
}, (t) => [
  uniqueIndex("hold_checks_epoch_member").on(t.epochId, t.memberId),
  check("hold_checks_threshold_positive", sql`threshold_raw > 0`),
  // a confirmed result carries its whole observation; nothing else does
  check("hold_checks_observation", sql`(status in ('holder','below')) = (raw_amount is not null and decimals is not null and provider is not null and slot is not null and observed_at is not null)`),
]);
```

Token amounts and slots are u64, beyond `bigint`, so they are `numeric(20,0)`, read as strings.

- [ ] Step 1: `pnpm --filter @hyphae/db exec drizzle-kit generate --name payout_gates`, then read the SQL: only `ALTER TABLE communities ADD COLUMN`, `CREATE TYPE`, `CREATE TABLE`, indexes and constraints. No change to an existing column.
- [ ] Step 2: `drizzle-kit check` exits 0, and `pnpm --filter @hyphae/api test` stays green (PGlite applies 0000–0009).
- [ ] Step 3: commit `feat(db): record rules-test passes, hold checks and the first paid epoch`.

## Task 2: rules test definition, grading and passes

**Files:** `apps/api/src/payout/rules-test.ts`, `rules-test.test.ts`.

**Interfaces (produces):**

```ts
export interface RulesTest {
  id: string;                                  // "mycel-rules-1"
  covers: { community: string; version: string }[];  // rubric label + version
  questions: { text: string; options: string[]; answer: number; why: string }[];
}
export const RULES_TESTS: readonly RulesTest[];
export function rulesTestFor(rubric: { community: string; version: string }, tests?: readonly RulesTest[]): RulesTest | undefined;
export function rulesTestById(id: string, tests?: readonly RulesTest[]): RulesTest | undefined;
export function grade(test: RulesTest, answers: readonly number[]): { correct: number; passed: boolean };
export async function recordPass(db: Db, input: { communityId: string; memberId: string; testId: string }): Promise<{ passedAt: Date; created: boolean }>;
export async function passesBefore(db: Db, input: { memberIds: string[]; testId: string; before: Date }): Promise<Set<string>>;
```

A test asserts every registered test is well formed: 1–8 questions, 2–4 options each, `answer` in range, non-empty `why`, non-empty `covers`, and an id of at most 13 characters (the button payload budget).

Tests, written first:
- the MYCEL test covers `MYCEL@1.2.0` only, has 6 questions and 3 options each; `rulesTestFor({community:"MYCEL",version:"1.3.0"})` and `…"DEMO"…` are undefined
- `grade`: all correct → `{6, true}`; one wrong → `{5, false}`; fewer answers than questions, an out-of-range option, or a non-integer → throws
- `recordPass` (PGlite): the first call creates with a database time; a second call returns the first `passedAt` with `created: false`; a member of another community throws (the insert checks that the member row's community matches)
- `passesBefore`: a pass at `closes_at − 1 ms` counts, a pass at exactly `closes_at` does not, and another test id does not

Commit: `feat(payout): define the MYCEL rules test and record passes`.

## Task 3: `/rules` in Telegram

**Files:** `apps/api/src/bot/commands/rules.ts`, `rules.test.ts`, `apps/api/src/bot/index.ts`.

**Flow:**
- `/rules` in a registered group → `Take the rules test privately: https://t.me/<bot>?start=rules_<community id>`. In a private chat → `Send /rules in your community chat.`
- `/start rules_<uuid>` in private → no community: `That community is not registered with Hyphae.`; no member row for (community, sender): `Link a wallet first: send /link in <name>.`; no rules test for the latest epoch's pinned rubric: `There is no rules test for <name>'s current rules yet.`; else an intro line and question 1.
- Each question is one message with one button per option. The callback data is `rt:<test id>:<community id>:<answers so far>`, with answers as digits (`mycel-rules-1` plus a UUID plus six digits is 60 bytes, within Telegram's 64). A tap edits the message to the next question. After the last one, it grades.
- The result: `Passed: 6/6. Your pass counts for epochs under the MYCEL 1.2.0 rules.` or `<n>/6. You need 6/6 to pass.`, then every question with its right answer and why, and a `Take it again` button (`rt:<test>:<community>:`).
- Every callback is answered (`answerCallbackQuery`). Data that does not parse, an unknown test, too many answers or a bad digit → `That test message is out of date. Send /rules in your community chat.` Nothing is recorded.
- The pass is recorded for the member found by (community id from the data, **sender's Telegram id from the update**). No member row → `Link a wallet first…`, nothing recorded.

Tests (grammY `Bot` with an API transformer, as in `me.test.ts`; PGlite for the passes), written first:
- group `/rules` gives the deep link; private `/rules` points to the group
- `/start rules_<id>` with no member → the link-first message; with a member → question 1 with 3 buttons whose data parses
- answering 6 correct taps (the data taken from each returned keyboard) records exactly one pass for that member
- five correct and one wrong → no pass, the review lists the right answers
- **forged data**: all-correct data sent by another Telegram user who is not a member → no pass; all-correct data for a community where the sender is a member of a different community → no pass for the other community; a digit `7`, seven answers, or an unknown test id → the out-of-date message, no pass
- `parseRulesData`/`rulesData` round-trip and stay ≤ 64 bytes

Commit: `feat(bot): /rules runs the six-question rules test in a private chat`.

## Task 4: the payout gate

**Files:** `apps/api/src/payout/gate.ts`, `gate.test.ts`.

**Interface (produces):**

```ts
export type Blocker = "legacy_epoch" | "already_published" | "not_final" | "before_first_paid_epoch"
  | "no_rules_test_defined" | "snapshot_mismatch" | "duplicate_wallet" | "hold_checks_pending" | "no_payable_members";
export type MemberReason = "no_points" | "no_verified_wallet" | "no_rules_test" | "below_hold" | "hold_pending";
export interface MemberVerdict { memberId: string; pointUnits: string; wholePoints: string; wallet: string | null;
  status: "payable" | "not_payable" | "held"; reasons: MemberReason[] }
export interface HoldRequirement { mint: string; thresholdRaw: bigint }  // thresholdRaw 0n: no hold condition
export type PayoutGate =
  | { status: "ready"; epochIndex: number; closesAt: Date; testId: string; hold: HoldRequirement; members: MemberVerdict[]; payable: number }
  | { status: "blocked"; epochIndex: number; closesAt: Date; blockers: Blocker[]; testId: string | null; hold: HoldRequirement | null; members: MemberVerdict[] };
export async function evaluatePayoutGate(db: Db, ref: { communityId: string; epochId: string },
  deps?: { tests?: readonly RulesTest[] }): Promise<PayoutGate>;
```

Order and definitions: the scope proposal's epoch checks 1–9 and member checks M1–M4, in one `repeatable read, read only` transaction, like the read service. `hold` is null until the pinned configuration has been read.

Tests (PGlite; the demo seed's closed epoch plus `seedRewardLane` fixtures), written first. Each blocker is produced by removing exactly one precondition from an otherwise clean epoch:
- **clean:** demo epoch 1 with `first_paid_epoch = 1`, a test registered for `DEMO@1.2.0`, the signed member's pass before close and a `holder` row → `ready`, the signed member `payable`, the pasted member `not_payable` with `no_points, no_verified_wallet, no_rules_test`
- `legacy_epoch` (an epoch row without a config); `already_published` (status `published`); `not_final` (demo epoch 2, open); `before_first_paid_epoch` (null, then 2 for epoch 1); `no_rules_test_defined` (no test for `DEMO@1.2.0`)
- `snapshot_mismatch`: a decision with `accepted_at < closes_at` inserted for a snapshot entry after the close; a snapshot member total edited; a late decision with `affects_allocation = true`
- `no_rules_test`: the pass at exactly `closes_at`; `no_verified_wallet`: the signed link ending before `closes_at`
- `below_hold`, and `held` for `pending` and `uncertain` rows, and for a `holder` row with another wallet or threshold → `hold_checks_pending`; `no_payable_members` when the only candidate is `below`
- `duplicate_wallet`: two members whose links name one wallet at `closes_at` (inserted directly)
- threshold `0` in the pinned rubric → no hold condition, the candidate is `payable` without a row
- **site agreement:** for every member of the demo's closed epoch, `no_verified_wallet` ⇔ the read API's leaderboard `wallet_status ≠ "verified"`, and the verdict's units equal the leaderboard's

Commit: `feat(payout): payout gate over a closed epoch (P9, P12, O6)`.

## Task 5: hold checks

**Files:** `apps/api/src/payout/hold-gate.ts`, `hold-gate.test.ts`, `apps/api/src/env.ts`.

**Interfaces (produces):**

```ts
export type HoldResult = Awaited<ReturnType<typeof checkHold>> | { kind: "uncertain"; reason: "not_configured" | "wrong_network" };
export type HoldChecker = (input: { projectId: string; owner: string; mint: string; thresholdRaw: bigint; checkRound: string }) => Promise<HoldResult>;
export function holdCheckerFromEnv(env: { HOLD_RPC_HELIUS_URL?: string | undefined; HOLD_RPC_FALLBACK_URL?: string | undefined }, fetchImpl?: typeof fetch): HoldChecker;
export async function runHoldChecks(db: Db, ref: { communityId: string; epochId: string }, deps: { check: HoldChecker; tests?: readonly RulesTest[]; clock?: () => Date }):
  Promise<{ status: "skipped"; blockers: Blocker[] } | { status: "window_closed" } | { status: "checked"; holder: number; below: number; uncertain: number }>;
export async function dueHoldChecks(db: Db, now: Date): Promise<{ communityId: string; epochId: string }[]>;
```

Tests, written first. The first group runs the **real SDK** through `holdCheckerFromEnv` with a fake `fetch` that answers JSON-RPC `getAccountInfo` (a parsed SPL mint, 6 decimals), `getTokenAccountsByOwner` and `getBlockTime` (now). These are guide §7's hold-gate cases:
- both providers ≥ threshold → `holder`; both below → `below`; exactly the threshold → `holder`
- providers disagree → `uncertain` `conflict`; either provider 503 → `uncertain` `outage`; block time 10 minutes old → `stale`; malformed JSON → `invalid-response`
- a missing URL → `not_configured`, with no fetch call; an `http:` URL → `not_configured`; both URLs on one host, or a Helius host as the fallback → `uncertain` (`invalid-response`); a devnet genesis hash on either provider → `uncertain` (`wrong_network`); a genesis call that fails → `uncertain` (`outage`), asked again next time

The runner (PGlite, with a scripted `HoldChecker`):
- candidates only: the demo's pasted member (no points, no wallet, no pass) gets no row
- the first run inserts one row per candidate with a UUID `check_round`; a retry reuses it; the checker receives the pinned threshold, `walletAt(closes_at)` and the community mint
- `uncertain` → row `uncertain`, `attempts` 1, gate `held`; the next run with `holder` → row `holder` with its observation, gate `ready` (**a cleared hold releases the claim**)
- `below` → gate `not_payable` `below_hold`; a later run whose checker would answer `holder` makes no call for that row and leaves `below` (confirmed results are final)
- a duplicate run racing a confirmed write (the checker answers `uncertain` after another run stored `holder`) → the conditional update leaves `holder`
- epoch before the first paid epoch, or open → `skipped`, no rows, no checker call
- a run more than 24 hours after `closes_at` → `window_closed`, no call, no row; the gate ignores a result observed before `closes_at` or more than 24 hours after it
- `dueHoldChecks`: returns an epoch with an `uncertain` row, or with no rows, 1–2 hours after its close; neither 25 hours after; not an epoch before `first_paid_epoch`; not an open epoch

Commit: `feat(payout): hold checks through the Sentinel SDK, recorded per member and epoch`.

## Task 6: worker wiring

**Files:** `apps/api/src/jobs/queue.ts` (`holdCheck: "hold-check"`, `retryLimit: 2, retryDelay: 60, expireInSeconds: 600`), `apps/api/src/jobs/reward-jobs.ts` (`checkEpochHolds(job)`, the close hook sends it, `recoverRewardWork` sends `dueHoldChecks`), `apps/api/src/worker.ts` (`boss.work(QUEUES.holdCheck, …)`).

The job logs `{ job: "hold-check", communityId, epochId, status, holder, below, uncertain }` and never a reason text beyond the fixed codes. It is wiring only. The logic is covered by Task 5. Verified by `pnpm -r typecheck` and a test that `recoverRewardWork`'s due list includes a hold epoch (if the jobs module can be tested without a live pg-boss; otherwise the typecheck plus Task 5's `dueHoldChecks` tests).

Commit: `feat(worker): run hold checks after a paid epoch closes and retry them in the sweep`.

## Task 7: records

`docs/BUILDLOG.md` entry, `docs/HANDOFF.md`, and a dated snapshot, with the Codex review verdict (arc step 5).

## Deploy notes (Cisco, not this arc)

1. Answer RT2 first. The questions go live with the deploy that contains Task 3.
2. Apply 0009 to Neon **before** deploying any `main` that contains Tasks 2–6. It is additive, so the running `b7bfe55` ignores it.
3. `fly secrets set HOLD_RPC_HELIUS_URL=… HOLD_RPC_FALLBACK_URL=…` (without them every candidate stays held).
4. Deploy.
5. After the Oct 1 go/no-go, and before epoch 2 closes (a first paid epoch recorded more than 24 hours after its close can never read a balance): `update communities set first_paid_epoch = 2 where mint = '<MYCEL mint>' and first_paid_epoch is null;` Until then no epoch is payable and no balance is read.
