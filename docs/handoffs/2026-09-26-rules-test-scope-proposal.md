---
date: 2026-09-26
summary: Scope of the rules test, the last policy gate before epoch 2 can be paid. Two different things have been called "the rules test". The approved policy means a six-question member quiz, passed 6/6 and recorded per member (P9, "passed the rules test before closes_at"). The session prompt means a payout preflight that checks a closed epoch before any allocation. P9 needs both, so this proposal names them apart. The rules test is the quiz. The payout gate is the preflight, and it reads the quiz pass as one of its member checks. The payout gate fails closed. It refuses an epoch unless it is final, unpublished, at or after the recorded first paid epoch, has a rules test defined for its pinned rubric, has a snapshot that equals the O6 selection at closes_at, has no member left on hold, and has at least one payable member. It uses the same wallet and snapshot reads as the audit site, so the two cannot disagree. Migration 0009 is needed and is not applied to Neon.
---

# Rules test: scope proposal

## Status and authority

- Written 2026-09-24 by Claude Code, Opus 5.5 (`claude-opus-5-5`), effort xhigh, Windows. The session prompt preferred Fable 5.1; this session ran on Opus 5.5.
- Authority: payment definitions P1–P16 ruled yes (`2026-09-24-contract-and-payment-rulings.md`). P9 defines a payable member, P12 makes epoch 2 the first paid epoch if the rules test and hold gate are live before 2026-10-02T00:00Z, P14 defines what the site shows, and P16 records the hold result. The arc (rules-test scope, hold-gate plan, build both by Oct 1) is Cisco's next action 5 in `docs/HANDOFF.md`.
- Sources for the rules test itself: the approved private brief (six questions, 6/6 to pass, retakes allowed, questions drafted in its §5) and the private implementation plan's task W2.16. Neither is in this repo. The question text is reproduced below because it is meant to be public.
- Companion: `2026-09-26-hold-gate-plan.md` (the hold gate, and the build plan for both gates).

## Finding: two things are called "the rules test"

| Name used here | What it is | Where it comes from | What it gates |
|---|---|---|---|
| **Rules test** | A six-question quiz on the community's rules that a member takes in a private chat and must pass 6/6. The pass is recorded with the database time. | Approved policy ("the first paid epoch opens after the rules test … is live"), the brief's six questions, P9 ("passed the rules test before `closes_at`"), P10's reason `no_rules_test` | One of the four conditions that make a member payable |
| **Payout gate** | A check over a closed epoch that decides whether it may be allocated and which members are payable, before any money moves. | This session's prompt (rubric pinned, no corrections outstanding, epoch closed cleanly, wallet verified), P9, P10, P12, P16 | Whether R6's publish may run for an epoch, and who gets a leaf |

The payout gate reads the rules-test pass as one of its member checks, together with the wallet, the hold result and the points. Both are needed for epoch 2, and they are built in this arc. From here on, "rules test" means the quiz, and the code uses the same two names.

## What you are saying yes to

Lines marked **ruled** restate a P-ruling so a worker can implement it; they need no new decision. Lines marked **new** need Cisco's yes or no. A "no" sends that line back.

| # | Item | Status | Recommendation and why |
|---|---|---|---|
| RT1 | The rules test is the six-question quiz. A pass needs 6/6. Retakes are unlimited. After every attempt the bot shows each question with the right answer and why. | ruled (approved brief) | **Yes.** It is the approved design. |
| RT2 | Question text: the brief's six questions as multiple choice, with three wording changes so every answer is true under the pinned rubric 1.2.0 and the code that runs today (see "Questions"). | **new** | **Yes.** Q2 must name the coin, because rubric 1.2.0 allows general market talk. Q5 must drop "and a strike", because strikes are not built. Q3 says "count" instead of "are paid", because points are not money. |
| RT3 | The rules test gates **payment only**, not `/submit`. A member without a pass still earns points; at publish they show with the reason `no_rules_test` (P10). | **new** (W2.16 said gate `/submit`; P9 and P10, ruled later, describe payment) | **Yes.** P10 shows points of members without a pass, which cannot exist if `/submit` refuses them, and `docs/TESTING.md` already tells testers the pass is needed "to be paid". |
| RT4 | A pass counts for an epoch only if it is a pass of the rules test defined for that epoch's pinned rubric (community label and version), and `passed_at < closes_at` by the database clock. | **new** (P9 does not say which version) | **Yes.** A paid member should have been tested on the rules they were paid under. Rubric 1.3.0, if it ever activates, needs its own test version. |
| RT5 | Taking the test: `/rules` in the group replies with a private deep link (`/start rules_<community id>`), as `/link` does. The quiz runs in the private chat with inline buttons, one question per message. Only a member with a linked wallet can record a pass. | **new** | **Yes.** It keeps answers out of the group, and every payable member has a member row anyway, because a verified wallet is required too. |
| RT6 | Storage: an insert-only `rules_test_passes` row (community, member, test id, `passed_at` from `clock_timestamp()`), unique per member and test. Failed attempts are not stored. | **new** | **Yes.** P9 only needs the time of the first pass. Storing wrong answers would keep data nothing reads. |
| PG1 | **The payout gate fails closed.** It returns `ready` only when every epoch check passes and every member is `payable` or `not_payable`. Anything it cannot decide blocks the epoch instead of guessing. | ruled (P9, P12, P16, the guide's "uncertain is never below") | **Yes.** A blocked epoch moves no money and can be retried. A wrong allocation cannot be taken back. |
| PG2 | Epoch checks, in order: pinned configuration (`legacy_epoch`), final snapshot (`not_final`), not already published (`already_published`), first paid epoch recorded and reached (`before_first_paid_epoch`), rules test defined for the pinned rubric (`no_rules_test_defined`), snapshot equal to the O6 selection at `closes_at` (`snapshot_mismatch`). | ruled (P9, P12, O3, O6), mechanism **new** | **Yes.** These are the prompt's "rubric pinned, epoch closed cleanly, no corrections outstanding", stated as checks against the tables that exist. |
| PG3 | "No unreviewed corrections outstanding" means: every decision accepted before `closes_at` is the one the snapshot selected, and no decision accepted at or after `closes_at` claims to affect the allocation. Corrections have no review queue in this system: a correction exists once it is committed. | **new** (definition) | **Yes.** A correction queue does not exist (A13). What can go wrong is a snapshot that disagrees with the decisions, and this check catches it. |
| PG4 | Member checks, for every member in the snapshot: exact points > 0 (`no_points`); the wallet link valid at `closes_at` has `method = 'signature'` (`no_verified_wallet`); a qualifying rules-test pass (`no_rules_test`); then, only if all three pass, the hold result: `holder` → payable, `below` → `below_hold`, anything else → **held**. | ruled (P9, P10, P16) | **Yes.** It is P9 in the order that costs no RPC call until one is needed. A member who fails several checks shows every reason that can be known without an RPC call. |
| PG5 | A **held** member (hold result missing or `uncertain`) blocks the whole epoch (`hold_checks_pending`). A held member is never payable and is never dropped. The hold gate retries, and a confirmed result releases or excludes the member. | **new** (P1–P16 do not cover an uncertain hold) | **Yes.** P10 leaves non-payable weight out of the denominator, so no one's share can be computed while one member is undecided. The guide forbids treating `uncertain` as `below`. |
| PG6 | An epoch with **no payable member** is blocked (`no_payable_members`): nothing is published, no fee is taken, and the pot stays unassigned in the vault. | **new** (P1–P16 do not cover it) | **Yes.** Publishing with no leaves would take the 3% fee for nothing and leave a balance that none of P11's three retained categories describes. |
| PG7 | A wallet held by two payable members at `closes_at` blocks the epoch (`duplicate_wallet`). | **new** (defensive) | **Yes.** Linking should make it impossible; if it ever happens, a leaf would pay one wallet twice. |
| PG8 | **The first paid epoch is recorded in the database:** a nullable `communities.first_paid_epoch`, null until Cisco sets it after the Oct 1 go/no-go (`2` for MYCEL if the gates are live in time). Null means no epoch of that community is payable. | **new** (P12 says what, not where) | **Yes.** P12 is conditional on Oct 1. Keeping the value null until it is set makes "nothing is paid until you decide" the default. Setting it is a Neon write, so it is Cisco's step. |
| PG9 | The gate and the audit site read the same facts through the same functions: `walletAt(closes_at)` for the wallet, the frozen snapshot for points, the epoch row for final and published. The site's "Not allocated" panel stays as it is until R6 wires P14's allocation section to the gate's output. | **new** | **Yes.** One reader per fact is how the page and the payout cannot disagree. P14 keeps the whole section unavailable until publish, so there is nothing new to show before then. |

## The rules test

### Questions (proposed, for RT2)

Test id `mycel-rules-1`, defined for rubric `MYCEL` 1.2.0. The correct option is marked. The explanation is what the bot shows after each attempt.

| # | Question | Options | Why |
|---|---|---|---|
| 1 | Which reply to a raid post earns points? | a) "lfg 🚀🚀" · **b) "The fee split going on-chain is the part I'd actually check. Where's the receipt?"** · c) "great project ser" | It reacts to something specific in the post. Hype that would fit under any post earns zero. |
| 2 | Can you say MYCEL's price is going up if you explain why? | a) Yes, if I give my reasons · b) Yes, if I add "not financial advice" · **c) No. Never where MYCEL's or any specific coin's price is going, with or without reasons.** | Under rubric 1.2.0, saying where a specific coin's price is going breaks the rules and scores 0, whatever the effort. General market talk is opinion and is allowed. |
| 3 | How many of your submissions count per raid? | **a) One reply and one quote** · b) Every reply I post · c) One reply, no quotes | The bot takes one reply and one quote per member per raid, and refuses a second of either. |
| 4 | A raid opened 30 hours ago. Do you still get full credit? | a) Yes, until the raid closes · **b) No. Full credit for the first 6 hours, then it falls to 0 at 48 hours.** · c) No. Nothing after 24 hours. | Timing is part of the rubric: full credit for 6 hours, then down to zero at 48 hours. |
| 5 | You post a friend's reply with two words changed. What happens? | a) It scores like any reply · b) It gets half points · **c) 0 points** | Copying another member's reply, or your own, earns zero. |
| 6 | An AI wrote your reply and you posted it unedited. What grade? | **a) Capped, and most likely 0. Rewrite it in your own words.** · b) Full marks if it is on topic · c) The bot refuses it before scoring | An unedited AI draft is capped at 79, or at 40 when it is obvious, and anything below 60 earns nothing. |

Differences from the brief's draft, all under RT2: Q2 names the coin (the brief's "never price direction" predates rubric 1.1.0's general-market carve-out); Q3 says "count" (points are not money); Q5 drops "and a strike" (strikes are not built, A15). The multiple-choice options are new; the brief gave only the answers.

Rubric 1.2.0's own text still says strikes exist ("first = warning, second = …"). That text is pinned and public; it is not changed here. It is listed under "Noted, not in this arc".

### Rules

- **Pass:** all six answered correctly in one attempt. The first pass inserts `rules_test_passes(member_id, test_id)`; a later pass of the same test changes nothing.
- **Time:** `passed_at` is `clock_timestamp()` at insert. A pass qualifies for an epoch when `passed_at < closes_at`, the same strict comparison O6 uses for decisions.
- **Version:** each test lists the rubrics it covers as `(community label, version)` pairs. The payout gate looks up the test for the epoch's pinned rubric. No test for it → the epoch is blocked (`no_rules_test_defined`), never "everyone passed".
- **Who:** a Telegram user with a member row in that community. Without one the bot answers "Link a wallet first: send /link in <community>." A member who relinks keeps their pass (the member id does not change on relink).
- **Retakes:** unlimited, no cooldown. The questions and answers are public, so a cooldown would only slow honest members.
- **Button data is not trusted.** Inline-button data comes back from the client. The bot re-derives the member from the Telegram-authenticated sender, re-validates every answer against the test, and grades all six at the end. A forged "all correct" is the same as knowing the answers, which the test publishes anyway.

## The payout gate

### Input and output

`evaluatePayoutGate(db, { communityId, epochId })` (in `apps/api/src/payout/gate.ts`) reads, in one read-only transaction: the epoch, its pinned configuration, the community's `first_paid_epoch`, the snapshot with its entries and member totals, the O6 selection recomputed at `closes_at`, each member's wallet link at `closes_at`, rules-test passes, and hold results. It writes nothing and takes no lock. The snapshot is frozen, and passes and hold results only ever move forward.

It returns:

```ts
type PayoutGate =
  | { status: "ready"; members: MemberVerdict[]; payable: number }
  | { status: "blocked"; blockers: Blocker[]; members: MemberVerdict[] };

type MemberVerdict = {
  memberId: string;
  pointUnits: string;          // exact, from the snapshot
  wholePoints: string;
  wallet: string | null;       // walletAt(closes_at), signature only
  status: "payable" | "not_payable" | "held";
  reasons: ("no_points" | "no_verified_wallet" | "no_rules_test" | "below_hold" | "hold_pending")[];
};
```

`members` is empty when an epoch-level check fails before the member stage (legacy, not final, published, before the first paid epoch, no test defined, snapshot mismatch). Members are sorted by member id.

### Epoch checks

| Order | Blocker | Fails when | Site shows today |
|---|---|---|---|
| 1 | `legacy_epoch` | `epochs.reward_config_id` is null, or its payload does not parse as `RewardConfigPayload` | 404 (legacy epochs are not served) |
| 2 | `not_final` | no `reward_epoch_snapshots` row, or `epochs.status` is not `closed` | `status: open` or `closing`, `final: false` |
| 3 | `already_published` | `epochs.status = 'published'` or `root` is set | not reachable before R6 |
| 4 | `before_first_paid_epoch` | `communities.first_paid_epoch` is null or greater than the epoch index | "Not allocated" (P14 later: "retained: epoch before the first paid epoch") |
| 5 | `no_rules_test_defined` | no rules test covers the pinned rubric's community label and version | "Not allocated" |
| 6 | `snapshot_mismatch` | snapshot `closes_at` ≠ epoch `closes_at`; the set of snapshot entries ≠ the epoch's intakes; an entry's decision, revision or points ≠ what `selectEffective(epoch, closes_at)` selects today; an entry without a decision whose contribution now has one accepted before `closes_at`; an `excluded` entry with no decision at all; the members' totals ≠ the sums of their entries; or an epoch decision whose `affects_allocation` ≠ (`accepted_at < closes_at`) | the read API already answers 503 when a selected revision disagrees with the snapshot |
| 7 | `duplicate_wallet` | two payable members have the same wallet at `closes_at` | — |
| 8 | `hold_checks_pending` | any member is `held` | "Not allocated" |
| 9 | `no_payable_members` | no member is `payable` | "Not allocated" |

Checks 1 to 6 stop the evaluation, each for a different reason: a legacy or unfinished epoch has nothing to evaluate, a published one has already been decided, and a mismatched snapshot cannot be trusted for anything. Checks 7 to 9 are reported together, after every member is evaluated. A `pending_reconciliation` or `pending_at_close` entry is not a blocker: under O3's strict close it earns 0 in that epoch and is final. The site already shows it with its reason.

### Member checks

| Order | Reason | Fails when | Same read as the site |
|---|---|---|---|
| M1 | `no_points` | snapshot member `point_units` = 0 | leaderboard `point_units` of a final epoch (`reward_snapshot_members`) |
| M2 | `no_verified_wallet` | `walletAt(member, closes_at)` is missing or not `signature` | `wallet_status` ≠ `verified` for a closed epoch (A5: as of `closes_at`) |
| M3 | `no_rules_test` | no `rules_test_passes` row for the required test with `passed_at < closes_at` | not served in v1 (A15) |
| M4 | `below_hold` / held | only when M1–M3 pass: the epoch's hold result for this member is `below` → `below_hold`; missing, `pending` or `uncertain` → `held` with `hold_pending` | not served in v1 |

`status` is `payable` when no reason applies, `held` when the only reason is `hold_pending`, and `not_payable` otherwise.

### What the payout gate does not do

- It does not compute amounts. Allocation, the 25%/15% cap, fee, dust and retained stay R6 (P6, P7, P10, P11). R6 takes the payable members and their exact units from the gate.
- It does not check the fee address, pot or vault (P2, P7, P8). Those are publish inputs, which R6 validates.
- It does not run hold checks. The hold gate does (`2026-09-26-hold-gate-plan.md`), and the payout gate only reads the results.

## Site agreement (PG9)

| Fact | Payout gate reads | Audit site reads | Test that pins it |
|---|---|---|---|
| Epoch final | snapshot row exists and `epochs.status = 'closed'` | the same (`final`) | gate test on the demo seed's open and closed epochs |
| Member points | `reward_snapshot_members` | the same, for final epochs | gate test: verdict units equal the leaderboard's for every member of the demo's closed epoch |
| Verified wallet | `walletAt(member, closes_at)`, `signature` | the same function, as of `closes_at` for closed epochs | gate test: `no_verified_wallet` exactly when the read API says `wallet_status ≠ verified` |
| Selected decision | the snapshot, checked against `selectEffective` at `closes_at` | the snapshot, checked against the revision lineage (503 on mismatch) | gate test: a decision inserted behind the snapshot's back blocks with `snapshot_mismatch` |

## Migration 0009 (written and tested locally, not applied)

Additive only. Existing code never reads these columns or tables, so the migration can go on Neon before or after the code that uses them. The code needs it: **apply 0009 before deploying any `main` that contains this arc**, the same order as 0006–0008 in Runbook B.

- `communities.first_paid_epoch integer` (nullable, checked ≥ 1).
- `rules_test_passes`: `id`, `community_id`, `member_id`, `test_id text`, `passed_at timestamptz(3)`; unique `(member_id, test_id)`.
- `hold_checks` and its status enum: specified in the hold-gate plan.

Writing this migration goes beyond the session prompt's writable paths (`docs/**`, `apps/api/src/**`, `packages/core/src/**`). The prompt's stop rule for a needed migration is "note it, don't apply it", and both gates need somewhere to record what they decide. So the migration is written and tested only against local databases (PGlite and Postgres 17 in Docker). It is reported as a deviation.

## Questions for Cisco

1. **RT2, question text.** Approve the six questions with the three changes? **Recommended: yes.** The `/rules` command should not go live with a false answer in it.
2. **RT3, payment only.** Confirm that the rules test does not gate `/submit`? **Recommended: yes**, as P10 and `docs/TESTING.md` already say.
3. **PG5, uncertain hold.** An undecided member holds the whole epoch until a check resolves them. **Recommended: yes.** The alternative, paying the others first, needs a rule for the held member's share, and no ruling has one.
4. **PG6, nobody payable.** Publish nothing, take no fee. **Recommended: yes.**
5. **PG8, first paid epoch.** Record it in `communities.first_paid_epoch`, set by you after the Oct 1 go/no-go with one attended SQL statement (`update communities set first_paid_epoch = 2 where mint = '<MYCEL mint>' and first_paid_epoch is null`). **Recommended: yes.**

## Noted, not in this arc

- Rubric 1.2.0's text promises strikes; strikes are not built (A15). The rules test does not repeat the claim. Fixing the rubric text is a rubric proposal (parked with 1.3.0).
- A rules test for rubric 1.3.0 is needed only if 1.3.0 is ever proposed and activated.
- Serving `rules_test_passed` or a pre-publish payability status on `/v1` is a new public field (A15 deferred it). P14 keeps the allocation section unavailable until publish.
