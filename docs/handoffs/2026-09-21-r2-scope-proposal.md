---
date: 2026-09-22
summary: Bounded R2 scope (pinned reward configuration + epoch admission) for written authorization. Additive schema, two API modules, set-rubric as a proposal producer, cooldown indexing with the E11/E12→E13 example, five acceptance tests, explicit exclusions. Nothing implemented yet.
---

# R2 scope proposal — pinned configuration and admission

## What you are saying yes to (one read)

R2 adds **immutable reward configuration** and **epoch admission** beside the existing tables, with no change to live bot behavior. After R2 merges, production behaves exactly as today: `/submit`, the score job and `/me` are untouched, the new tables are empty, and the migration is generated but **not applied to Neon** until you say so. R1 arithmetic is not modified.

Scope in one line: four additive schema objects, `apps/api/src/rewards/config.ts` and `rewards/intake.ts` with tests, `set-rubric.ts` turned into a proposal producer, and one new dev dependency (PGlite) so the database tests run in-process with no network.

Five yes/no decisions are at the end. Estimated effort: one implementation session, about five hours, plus review.

## Baseline read (2026-09-22)

- `main` at `aebb147` = `origin/main`. R1 accepted and merged 2026-09-21. Repo has no CI; the native gate (`pnpm test`, `pnpm typecheck`, `biome check .`) is the only evidence.
- `epochs` has no writer anywhere in the code, so it is empty unless someone inserted rows by hand. `communities.rubric` is mutable and read by the score job and `/raid`. `set-rubric.ts` updates it in place. `/submit` inserts `contributions` and queues a job; `contributions.submitted_at` defaults to `now()`, which is transaction start time and therefore not acceptance evidence under O3.
- Fly has no release command, so a deploy never applies migrations by itself.
- Drizzle 0.45.2 already ships `drizzle-orm/pglite` and its migrator; only the `@electric-sql/pglite` package is missing.

## Invariants R2 must hold (resolved before code)

| # | Invariant | How R2 enforces it |
|---|---|---|
| I-1 | An epoch is the half-open UTC window `[opensAt, closesAt)`. Intake at exactly `closesAt` belongs to the next epoch. | Pure `epochAt(epochs, t)` uses `opensAt <= t < closesAt`; tested at `closesAt` and `closesAt − 1 ms`. |
| I-2 | Epochs are contiguous: `opensAt(E[n+1]) = closesAt(E[n])`, `closesAt(E[n+1]) = opensAt(E[n+1]) + duration(E[n+1])`. Duration comes from the config pinned to the **new** epoch. | Pure `nextWindow(prev, durationSeconds)`; materialization only ever appends from the last epoch. |
| I-3 | Durable acceptance order per community equals commit order. | Every R2 write (bootstrap, propose, cancel, materialize, admit) runs in one transaction that first takes `SELECT … FROM communities WHERE id = $1 FOR UPDATE`, then reads `clock_timestamp()` as `acceptedAt`. The lock is held to commit, so `acceptedAt` is monotone per community and no intake can be accepted "before close" yet commit after a later close transaction. R5's close will take the same lock. |
| I-4 | A pinned configuration never changes. | `reward_configs` rows are insert-only and unique on `(community, digest)`; epochs reference a config id; intakes copy the epoch's config id. `communities.rubric` becomes staging input only. |
| I-5 | Cooldown: a proposal accepted during E(k) with last activation E(a) activates no earlier than `E(max(k+1, a+2))`. Initial activation counts. A no-op payload is rejected, so it cannot reset anything. One pending proposal per community; replacing it preserves `a`. | Pure `earliestActivationEpoch(k, a)`; partial unique index on pending; `proposeRewardConfig` supersedes the existing pending row in the same transaction. |
| I-6 | Only the epoch that contains "now" or earlier is ever materialized. Nothing opens ahead of time, so a pending proposal always targets an unmaterialized epoch. | `ensureEpochAt(t)` loops `while last.closesAt <= t`. |
| I-7 | Disabled operation is an explicit intake pause, not a config change. | `communities.reward_intake_paused_at`; admission returns `paused`; epochs keep their schedule. |
| I-8 | Legacy data never silently enters the new lineage. | Pre-R2 contributions have no intake row. An epoch without `reward_config_id` refuses admission. No backfill. |

## Schema (additive, forward-only)

Additions to `packages/db/src/schema.ts`; nothing existing is renamed, dropped or retyped.

```ts
// Immutable reward configuration bundles (O4). Insert-only.
export const rewardConfigs = pgTable(
  "reward_configs",
  {
    id: id(),
    communityId: uuid("community_id").notNull().references(() => communities.id),
    payloadVersion: integer("payload_version").notNull(),
    payload: jsonb("payload").notNull(),
    // Internal digest of the versioned canonical payload. Not the O7 configuration hash.
    digest: text("digest").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reward_configs_community_digest").on(t.communityId, t.digest)],
);

export const rewardProposalStatus = pgEnum("reward_proposal_status", [
  "pending",
  "activated",
  "superseded",
  "cancelled",
]);

// Proposal and activation history (O4). A row changes status once; values never change.
export const rewardConfigProposals = pgTable(
  "reward_config_proposals",
  {
    id: id(),
    communityId: uuid("community_id").notNull().references(() => communities.id),
    configId: uuid("config_id").notNull().references(() => rewardConfigs.id),
    proposedBy: text("proposed_by").notNull(), // "script:set-rubric" until H-CONTRACT defines actors
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    acceptedInEpoch: integer("accepted_in_epoch"), // null only for the bootstrap activation
    earliestActivationEpoch: integer("earliest_activation_epoch").notNull(),
    status: rewardProposalStatus("status").notNull(),
    activatedEpochIndex: integer("activated_epoch_index"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedReason: text("resolved_reason"),
  },
  (t) => [
    uniqueIndex("reward_config_proposals_one_pending")
      .on(t.communityId)
      .where(sql`${t.status} = 'pending'`),
    index("reward_config_proposals_community_accepted").on(t.communityId, t.acceptedAt),
  ],
);

// Immutable reward intake (O2/O3). One row per admitted contribution. Insert-only.
export const rewardIntakes = pgTable(
  "reward_intakes",
  {
    id: id(),
    communityId: uuid("community_id").notNull().references(() => communities.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    epochId: uuid("epoch_id").notNull().references(() => epochs.id),
    configId: uuid("config_id").notNull().references(() => rewardConfigs.id),
    contributionId: uuid("contribution_id").notNull().references(() => contributions.id),
    taskId: uuid("task_id").references(() => tasks.id),
    artifactKey: text("artifact_key").notNull(), // "x:status:<id>" or "text:sha256:<hex>"
    idempotencyKey: text("idempotency_key").notNull(), // "tg:<chat_id>:<message_id>"
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    capture: jsonb("capture").notNull(), // { source, capturedAt, limitations[] }
  },
  (t) => [
    uniqueIndex("reward_intakes_contribution").on(t.contributionId),
    uniqueIndex("reward_intakes_community_artifact").on(t.communityId, t.artifactKey),
    uniqueIndex("reward_intakes_community_idempotency").on(t.communityId, t.idempotencyKey),
    index("reward_intakes_epoch_member").on(t.epochId, t.memberId),
  ],
);
```

Two nullable columns on existing tables:

```ts
// epochs: the pin. Null means a legacy epoch that cannot admit reward intake.
rewardConfigId: uuid("reward_config_id").references(() => rewardConfigs.id),

// communities: explicit intake pause (I-7). Null means intake is allowed.
rewardIntakePausedAt: timestamp("reward_intake_paused_at", { withTimezone: true }),
```

Migration: `pnpm --filter @hyphae/db generate --name reward_config_intake` produces `packages/db/drizzle/0003_reward_config_intake.sql` plus `meta/0003_snapshot.json` and the journal entry. Expected statements: one `CREATE TYPE`, three `CREATE TABLE`, two `ALTER TABLE … ADD COLUMN`, the foreign keys, and the indexes above. Generation needs no database. **Applying it to Neon is not part of R2**; the tests apply it to PGlite. `epochs.rubric_hash` stays unused (hash schemas belong to H-CONTRACT).

Not modeled on purpose: an exclusion constraint on epoch windows (needs `btree_gist`, and the community lock already serializes writers) and the one-reply-one-quote uniqueness (stays in the `/submit` adapter as today).

## Configuration payload v1

Zod schema in `config.ts`. The bundle is complete and self-describing so R3+ never reads mutable settings.

| Field | Content | Validation |
|---|---|---|
| `version` | `1` | literal |
| `rubric` | the public rubric object, unchanged shape (`RubricSchema`) | existing schema |
| `epoch.durationSeconds` | `604800` by default | positive integer |
| `timing.fullCreditUntilMs`, `timing.zeroCreditAtMs` | `rubric.timing` × 60 000 | integers; `zero > full`; must equal the rubric minutes |
| `credit.floor`, `credit.aiCapMild`, `credit.aiCapStrong`, `credit.hardZeroFlags` | `60`, `79`, `40`, `["guideline_breach","spam","off_topic"]` | must equal the R1 constants; any other value is rejected, so changing a gate requires an R1 change and a new activation |
| `effort.multiplierBps`, `effort.slotLimit`, `effort.candidatesPerSlot`, `effort.retrievalRounds` | `30000`, `1`, `3`, `3` | integer bps ≥ 10 000; positive integers |
| `points.unitsPerPoint`, `points.rounding`, `points.maxWholePoints` | `"100000000"`, `"half_up_after_aggregation"`, `"18446744073709551615"` | must equal the R1 constants |

`digest = sha256Hex(canonicalJson({ version, payload }))`. It is an internal identity for deduplication and the no-op check. It is not the O7 configuration hash: canonical JSON here still carries rubric weights as floats, which O7 forbids for commitments.

Strike, hold and cap policies are not in v1 because nothing implements them yet. Adding a field is payload version 2 and therefore a new activation.

## `apps/api/src/rewards/config.ts`

Pure (unit-tested without a database):

- `RewardConfigPayload`, `buildRewardConfigPayload(rubric)` (defaults above), `configDigest(payload)`.
- `earliestActivationEpoch(acceptedInEpoch, lastActivation) = max(k + 1, a + 2)`.
- `nextWindow({ closesAt }, durationSeconds)`.
- `epochAt(epochs, t)` half-open lookup.

Database (each inside the community lock, I-3):

- `bootstrapRewardEpochs(db, { communityId, payload, opensAt, proposedBy })`. Requires zero epochs for the community, `opensAt` strictly in the future on a whole second. Inserts the config (or reuses it by digest), a proposal with status `activated`, `acceptedInEpoch = null`, `earliestActivationEpoch = 1`, `activatedEpochIndex = 1`, and epoch index 1 pinned to it. Initial activation counts, so `a = 1`.
- `ensureEpochAt(tx, communityId, t)`. Materializes epochs contiguously from the last one until the epoch containing `t` exists. For each new index `n`: if a pending proposal has `earliestActivationEpoch <= n`, pin its config, set the proposal `activated` at `n`; otherwise pin the previous epoch's config. Duration comes from the pinned config. Returns the epoch containing `t`, or null when `t` precedes epoch 1. Never materializes an epoch that opens after `t`.
- `proposeRewardConfig(db, { communityId, payload, proposedBy })`. Calls `ensureEpochAt(now)`, sets `k` = index of that epoch, `a` = highest `activatedEpochIndex`. Rejects when the payload digest equals the currently pinned config's digest (no-op). Marks an existing pending proposal `superseded`, inserts the new pending row with `earliestActivationEpoch = max(k + 1, a + 2)`. Returns the row so the script can print the activation epoch.
- `cancelRewardProposal(db, communityId)`. Pending → `cancelled` with reason; `a` unchanged.
- `setRewardIntakePaused(db, communityId, paused)`.

R5 will call `ensureEpochAt` when it closes an epoch. R2 owns opening; R5 owns closing and the snapshot. `epochs.status` is not touched by R2.

## `apps/api/src/rewards/intake.ts`

- `artifactKeyFor(kind, { statusId | text })`: `x:status:<id>` from the oEmbed-resolved status id, or `text:sha256:<hex>` of the raw text. URL spelling never enters the key.
- `admitContribution(db, input)` where input = community, member, optional task, the contribution values as `/submit` builds them today, `artifactKey`, `idempotencyKey`, `capture`. Steps inside the lock, in this order:
  1. paused → `{ status: "paused" }`.
  2. idempotency key exists → `{ status: "admitted", intake, created: false }`.
  3. `ensureEpochAt(now)` → null → `{ status: "not_open" }`; epoch without pin → `{ status: "legacy_epoch" }`.
  4. task given and `now < task.opensAt` → `{ status: "before_task_open" }` (O5 rejects intake before opening).
  5. artifact key exists → `{ status: "duplicate_artifact", intake }`.
  6. insert the `contributions` row and the `reward_intakes` row with `acceptedAt = now`, `configId = epoch.rewardConfigId` → `{ status: "admitted", intake, created: true }`.

Preflight split: format, oEmbed access, handle binding and one-reply-one-quote stay in the `/submit` adapter (unchanged in R2). Intake owns pause, window, task opening, artifact identity and idempotency.

Queueing stays with the caller. Admission returns the record; R3's adapter enqueues after commit with a singleton key. A crash between commit and enqueue is recovered by calling admission again with the same idempotency key. **In R2 nothing calls `admitContribution` in production**; `/submit` keeps its current path.

Timing inputs are stored, not computed: R3 derives `timingBps` from `intake.acceptedAt`, `task.opensAt` and the pinned `timing` fields through R1. `contributions.submitted_at` stays as it is and is not reward evidence.

## `apps/api/scripts/set-rubric.ts` as a proposal producer

Today: replaces `communities.rubric` in place; the next score job uses it immediately.

After R2:

```text
set-rubric <mint> <rubric.json>                       # staging update + pending proposal
set-rubric <mint> <rubric.json> --activate-at <iso>   # bootstrap: only when the community has no epochs
set-rubric <mint> --cancel                            # cancel the pending proposal
```

1. Validates the rubric with `RubricSchema` (as today).
2. Updates `communities.rubric` and `rubric_version` (as today). This is explicitly the **staging** copy: it still drives the legacy score job and `/raid` defaults until R3 rewires them. Label printed by the script.
3. Builds payload v1 from the rubric and default policy, then `proposeRewardConfig`. Prints: config digest, `k`, `a`, earliest activation epoch, and which pending proposal was superseded. A no-op proposal exits non-zero with the reason.
4. With `--activate-at`, runs `bootstrapRewardEpochs` instead of step 3 and prints epoch 1's window.

The script never pins an open epoch. Nothing about the reward lane changes until the scheduled boundary opens.

`scripts/reward-intake.ts <mint> pause|resume` flips the pause column (I-7). Two scripts, two names, no flags that change meaning.

## Cooldown indexing, worked example

Rule: proposal accepted during E(k), last activation E(a) → earliest activation `E(max(k + 1, a + 2))`.

| Step | Event | k | a | Earliest | Result |
|---|---|---|---|---|---|
| 1 | E11 opens pinning config A (activated at 11) | | 11 | | A fixed for E11 and E12 |
| 2 | Proposal P1 (config B) accepted during E11 | 11 | 11 | max(12, 13) = 13 | pending, earliest 13 |
| 3 | E12 opens | | 11 | | 13 > 12, so E12 pins A |
| 4 | Proposal P2 (config C, 14-day duration) accepted during E12 | 12 | 11 | max(13, 13) = 13 | P1 superseded, P2 pending, `a` still 11 |
| 5 | E13 opens at `closesAt(E12)` | | 13 | | pins C; `closesAt(E13) = opensAt(E13) + 14 d`; P2 activated |
| 6 | Proposal P3 accepted at exactly `closesAt(E12)` | 13 | 13 | max(14, 15) = 15 | boundary acceptance belongs to E13; earliest 15 |
| 7 | Proposal of config C while C is pinned | | | | rejected as no-op; `a` unchanged |
| 8 | E14 opens at `closesAt(E13)` | | 13 | | pins C (14 days); no gap, no overlap |

Step 6 works because `proposeRewardConfig` materializes E13 first (activating P2, `a = 13`), then computes `k` and `a`. Bootstrap counts as `a = 1`, so a community that activates at E1 can change configuration no earlier than E3.

## Acceptance tests (the five from the plan row, plus guards)

Files: `apps/api/src/rewards/config.test.ts` (pure) and `apps/api/src/rewards/intake.test.ts` (PGlite, migrations 0000–0003 applied in `beforeAll`).

| Plan case | Test |
|---|---|
| Half-open equality | `epochAt` at `closesAt` returns E[n+1], at `closesAt − 1 ms` returns E[n]; admission at exactly `closesAt` lands in E[n+1]. |
| Pin survives later rubric change | Bootstrap A; admit c1 → `configId = A`; run the set-rubric path with rubric B (staging updated, proposal pending); admit c2 in the same epoch → still A; c1 unchanged; the next materialized epoch that clears cooldown pins B. |
| E11 activation blocks replacement through E12 until E13 | Pure table for `earliestActivationEpoch` covering steps 2, 4, 6 above; PGlite run with 60-second epochs materializing E11→E14 and asserting which config each epoch pins and each proposal's final status. |
| Duration has no gap/overlap | Pure `nextWindow`; PGlite: 7-day A then 14-day C at E13 → `opensAt(E13) = closesAt(E12)`, `closesAt(E13) − opensAt(E13) = 14 d`, `opensAt(E14) = closesAt(E13)`. |
| Duplicate alias/webhook maps once | Same idempotency key twice → one contribution, one intake, `created: false`; two URL spellings resolving to one status id → `duplicate_artifact`, one row; the unique indexes are asserted directly. |

Guards: no-op proposal rejected; pending uniqueness; cancel preserves `a`; intake before epoch 1 → `not_open`; paused → `paused`; legacy epoch (null pin) → `legacy_epoch`; `before_task_open`; payload validation rejects a floor other than 60, a multiplier under 10 000, a zero duration, and mismatched timing milliseconds.

Limitation stated up front: PGlite is single-connection, so the race between two simultaneous admissions is proven by the unique indexes and the lock discipline, not by a true concurrent run. A real-Postgres concurrency check belongs to the R3 review, which owns the dispatch race.

## What stays out of R2

- R3: slots, candidates, retrieval rounds, dispatch fencing, nomination adapter, any change to `/submit`, `jobs/score.ts`, `scoring/run.ts`, `worker.ts`, `queue.ts`.
- R4: effective-decision reads, `/me`, corrections.
- R5: close, snapshot, `epochs.status` transitions, late results, re-entry.
- R6 and H-CONTRACT: public routes, commitment hashes, wire schemas, admin auth, wallet migration; `epochs.rubric_hash` stays null.
- Settlement, root, claim, `settle.ts`, Anchor program, Organic.
- Fixture conversion, paid model runs, any model call in tests.
- Applying the migration to Neon, bootstrapping MYCEL, deploying. Cutover is a separate authorized step after the migration is applied: bootstrap on a future boundary with intake paused, then resume.
- Sentinel SDK adoption. Vault edits.
- Backfilling legacy contributions or epochs.

## Evidence stage and gate

- Runner: Claude Code, Fable 5.1 (`claude-fable-5-1`), effort xhigh, Windows, 2026-09-22.
- Evidence after implementation: native gate only. `pnpm test` (core + api, api now including PGlite tests), `pnpm typecheck`, `biome check .`, `git diff --check`. No CI exists. No Neon command, deploy, model call, fixture run, root, claim or payment.
- Delivery: branch `feat/r2-pinned-config`, implementation and tests in one commit, migration in the same commit, docs in a separate commit, PR to `main`, independent review before merge (same practice as R1).

## Decisions requested (yes/no each)

1. **Schema**: the four additions above, migration generated in-repo and **not applied** to Neon in R2.
2. **PGlite** (`@electric-sql/pglite`) as an `apps/api` dev dependency for in-process database tests.
3. **No live rewiring**: `/submit`, the score job and `/me` untouched; `admitContribution` has no production caller until R3.
4. **`set-rubric.ts`** keeps the staging update and records a proposal; `--activate-at` bootstraps; `--cancel` cancels; pause/resume in `reward-intake.ts`.
5. **Epoch numbering** starts at 1; bootstrap takes an explicit future whole-second UTC `opensAt`.

A "yes" to all five is R2 authorization. A "no" on any item returns this document for revision, not partial implementation.

## Calendar rebaseline (proposal for the vault sync; not applied)

Colosseum ends 2026-10-12 23:59 PDT. Today is Tuesday 2026-09-22. The Week 2–4 outline in the plan predates R1–R6 and the H-CONTRACT gate. Proposed replacement, R-stages first, demo-scope choices left to Cisco:

| Window | Ships | Gate it depends on |
|---|---|---|
| Sep 22–23 | R2 (this proposal), reviewed and merged | R2 authorization |
| Sep 24–26 | R3 slots/dispatch/nomination; `/submit` rewired to intake; weekly video #2 Fri Sep 25 shows pinned config and admission on a paused, unfunded community | R2 merged |
| Sep 27–28 | R4 effective reads; `/me` epoch-scoped | R3 merged |
| Sep 29–30 | R5 close snapshot (unfunded); migration applied to Neon; MYCEL bootstrapped at a future boundary with intake paused | R4 merged; separate cutover authorization |
| Oct 1–3 | `apps/web` audit page and community page on R4 reads; public read API v1 | R4/R5 |
| Oct 3–5 | Anchor: three instructions, LiteSVM tests, devnet register/publish/claim on the Hyphae Lab community; weekly video #3 Fri Oct 2 | H-CONTRACT decides the leaf/commitment contract by Sep 30, or devnet uses the existing leaf encoding with an unfunded internal snapshot |
| Oct 6–8 | R6 only if H-CONTRACT is settled; otherwise security review, polish, README, OpenAPI | H-CONTRACT, fee/funding/payment |
| Oct 9 | Final video | |
| Oct 10 | Submit; buffer to Oct 12 | |

Two decisions for the vault, not for this repo: whether a mainnet payout remains a hackathon target (if yes, H-CONTRACT and the fee/funding definitions must close by Sep 30), and whether the web audit page ranks above the on-chain claim if only one fits. Elapsed Week 1–2 targets are not converted into extra hours.
