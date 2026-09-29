---
date: 2026-09-29
summary: The Oct 2 arc's branch work ran early, on Cisco's choice, three days before its start gate. On feat/jev-eval, DEP-06 turned the founder's targets into runnable grades for the 16 synthetic cases under the ±5 range rule (4a4f4ec, CI green); the Jev backend, the live runs and the report wait for Cisco's Sep 30 question set, which does not exist yet. On feat/rules-v2, rubric 1.3.0 got its own rules test (mycel-rules-2, six worked examples quoted from the founder-graded cases), the bot links a new /rules study page before the test, and the page keeps the rules now apart from the rules planned for epoch 4 by reading the open epoch's rubric. Three fresh Codex gpt-6-astra xhigh rounds: FIX, then SHIP, then SHIP; every finding fixed test-first. Both branches are pushed; neither is merged. main's API code is unchanged since b3c82c7. Epoch 1's close check and the Ledger devnet deploy wait for Oct 2.
---

# Branch work ahead of the Oct 2 arc

## Status and authority

- **Runner:** Claude Code, Opus 5.5 (`claude-opus-5-5`), effort **xhigh**, Windows. Cisco present at the start.
- **The prompt's start gate:** "Start after 2026-10-02T00:00Z". At 16:43Z on 2026-09-29 epoch 1 had not closed and Cisco's Sep 30 Jev question set was not in the vault, so the agent asked. Cisco chose **branch work now**: steps 2a, 4 and 5, on branches only; steps 1, 2b–2d, 3 and 6's receipts wait until after Oct 2.
- **Authority:** Cisco's rulings of 2026-09-28 (the Jev eval as option A with the ±5 range rule, pushing `feat/jev-eval`) and of 2026-09-29 (board decision 2: rules test v2, the study page and rubric 1.3.0 built on a branch, merged after the Oct 9 payout, activated at epoch 4 on Oct 16).
- **Writable, as used:** `apps/api/**`, `apps/web/**`, `docs/**` on the two branches; `docs/**` on `main`. No vault or sibling write. No change under `programs/hyphae` or to `docs/rubrics/*.json`, so `FCisco95/hyphae-program` needs no sync (the new fixture sits in `docs/rubrics/eval/`, which the public repo does not carry).

## Branches

| Branch | Commits (oldest first) | CI | State |
|---|---|---|---|
| `feat/jev-eval` | `4a4f4ec` | `36626690355` green | Pushed. Merges only after the Oct 9 payout is confirmed. |
| `feat/rules-v2` | `da939d9`, `04bf525`, `eec66a9`, `c9e08f2`, `ac1ed17` | `36632475551` green | Pushed after review round 3 (SHIP). Merges after the Oct 9 payout. |

`main` stays at `b3c82c7` for code; `git diff b3c82c7 main -- apps/api` is empty.

## Step 2a: runnable founder grades (DEP-06)

`apps/api/src/scoring/founder-grades.ts` converts `docs/rubrics/eval/mycel-synthetic-review.json` (unchanged, SHA-256 `1b851fa0…6afd936`) into the harness fixture `docs/rubrics/eval/mycel-synthetic.json`. A test holds the fixture equal to the converter's output; `scripts/founder-grades.ts` regenerates it.

The rule, as ruled: raw and credited each within the founder target ±5, clamped to 0–100; hard-zero cases credit exactly 0; case 12 keeps 75–80. The credited target is `creditedScore` applied to the founder's raw target with the case's required flags, the expected AI signals standing in for `aiSlop.patterns`. A credited score is either 0 or at least 60, so every credited target of 0 is exact, below-floor cases included. The harness now reports each case's absolute error against the founder target (0 inside a target range).

| # | Case | Target raw | Accepts raw | Target credited | Accepts credited |
|---|---|---|---|---|---|
| 1 | receipt-specific-praise | 70 | 65–75 | 70 (mild AI cap 79) | 65–75 |
| 2 | receipt-specific-criticism | 90 | 85–95 | 90 | 85–95 |
| 3 | popularity-no-quality-bonus | 35 | 30–40 | 0 (floor) | 0 |
| 4 | holder-with-product-reason | 75 | 70–80 | 75 | 70–80 |
| 5 | holder-only | 0 | 0–5 | 0 | 0 |
| 6 | grounded-uncertain-price | 85 | 80–90 | 85 | 80–90 |
| 7 | unsupported-price-with-hedge | 50 | 45–55 | 0 (breach) | 0 |
| 8 | buy-guaranteed-gains | 0 | 0–5 | 0 (breach) | 0 |
| 9 | honest-reward-disclosure | 90 | 85–95 | 90 | 85–95 |
| 10 | question-already-answered | 10 | 5–15 | 0 (floor) | 0 |
| 11 | project-name-wrong-topic | 50 | 45–55 | 0 (off topic) | 0 |
| 12 | polished-strong-original-control | 75–80 | 75–80 | 75–80 | 75–80 |
| 13 | multiple-ai-writing-signals | 70 | 65–75 | 0 (strong AI cap 40, floor) | 0 |
| 14 | single-ai-word-false-positive-control | 75 | 70–80 | 75 | 70–80 |
| 15 | image-context-limitation | 75 | 70–80 | 75 | 70–80 |
| 16 | code-only-spam | 0 | 0–5 | 0 (spam) | 0 |

`eval-scoring --dry-run` reads all 16 against rubric 1.3.0 with no key and no model call.

**Not done in step 2 (the prompt's stop: the question set is missing):** 2b (the Jev backend with `@typesafe-ai/sdk`, `jev-1.13.0`, the question module and the recorded mode), 2c (the live Jev and Sonnet runs) and 2d (`docs/evals/2026-10-jev-vs-sonnet.md`). No model was called and nothing was spent.

## Step 4: rules test v2 and the study page

- **`mycel-rules-2`** (`apps/api/src/payout/rules-test.ts`) covers MYCEL 1.3.0 only. Six questions of three options, each a worked example whose reply is quoted word for word from a founder-graded case (a test checks the quote): criticism (case 2), grounded price talk (6), a bare target with "NFA" (7), stacked AI phrases (13), one AI word (14), "I hold MYCEL." (5). Questions 1, 2, 3 and 6 ask to rate the reply; 4 and 5 ask "good, fake or bot engagement?". Every question carries its own post, because each message replaces the last. Keyed answers: 1, 0, 2, 1, 0, 2, pinned apart from the key.
- **Eligibility (RT4 unchanged):** the payout gate still takes the test for the epoch's pinned rubric. An epoch under 1.2.0 keeps `mycel-rules-1`; one under 1.3.0 needs a pass of `mycel-rules-2`, and a pass of `mycel-rules-1` does not count (a new gate test; it fails without the new test registered).
- **The bot:** each test names its study page (`study: "/rules"`). `/rules` in the group and the private test both link `PUBLIC_WEB_URL/rules` before the first question; a community whose current rules have no test gets the old message. Every message the test can produce fits 4096 characters (the longest v2 result is 2,845) and every button 64 bytes (60).
- **`/rules` on the site** (`apps/web/app/rules`, `components/rules.tsx`, `lib/rules.ts`): reads the open epoch's pinned rubric through the read API and shows "The rules now" from it. Before epoch 4 with 1.2.0 open: 1.2.0 as now and "Planned for epoch 4: rubric 1.3.0". If epoch 4 opens under 1.2.0: "Planned: rubric 1.3.0". Once 1.3.0 is read as open: 1.3.0 as now, 1.2.0 as "Earlier rules". If the API can't be read, or the epoch closed between the two reads, or it uses a rubric the page does not cover, the page says so and claims no current rubric. The sixteen founder-graded replies appear word for word with the founder's grade and the credit production gives; a test holds them to the review file and to `creditedScore`/`creditReason`. Case 6 carries a note that rubric 1.2.0 grades it a breach, shown until 1.3.0 is read as in force. Strikes appear in the rubric text but are not built, so the page leaves them out. The header links the page. Checked in a production build against the live API, at desktop width and at 390 px: "Epoch 1 is open now and scored under rubric 1.2.0.", no sideways scroll.
- **Not scheduled:** activation. The O4 proposal for epoch 4 comes during epoch 3, after the payout (proposal accepted in E3, last activation E1, so the earliest activation is E4).

## Step 5: review

Three fresh, read-only Codex sessions, `gpt-6-astra`, reasoning `xhigh` (log headers confirm), each over `git diff main...feat/rules-v2`:

| Round | Verdict | Findings | Fix |
|---|---|---|---|
| 1 | FIX | Major: the page's headings asserted an epoch-4 activation it had not read ("From epoch 4", "Before epoch 4"); a slipped O4 would leave epoch 4 on 1.2.0 while the page taught 1.3.0's price rules. Minor: questions 3 and 5 said "the same post", which the next message replaces. | `eec66a9`, test-first |
| 2 | SHIP | Minor: with the API down, 1.3.0 still read as awaiting activation. Minor: an epoch closed between the two reads still showed as open. | `c9e08f2`, test-first |
| 3 | SHIP | Minor: the quiz tests took the right answers from the key itself, so a wrong key would pass. | `ac1ed17`: the keyed texts pinned; a probe moving question 2's key failed only this test |

Round 3 confirmed: eligibility unchanged for 1.2.0, no pass crosses tests, the strict `passed_at < closes_at` cutoff and callback re-validation intact, all six keys true under 1.3.0 and the credit rules, all sixteen examples' credits right. `ac1ed17` is test-only and came after round 3's SHIP.

## Validation

| Gate | `feat/jev-eval` (`4a4f4ec`) | `feat/rules-v2` (`ac1ed17`) |
|---|---|---|
| `pnpm test` | 754 passed + 1 skipped (core 106, web 79, api 569) | 771 passed + 1 skipped (core 106, web 111, api 554) |
| `pnpm typecheck` | 0 | 0 |
| Biome | 272 files, clean | 272 files, clean |
| `drizzle-kit check` | pass | pass |
| `test:pg` | 44/44 | 44/44 |
| `git diff --check` | clean | clean |

**Flaky on `feat/jev-eval`'s full runs, in code the branch does not touch:** 3 of 5 full `pnpm test` runs failed one test each, and 1 of 4 runs of the API suite alone failed two, all timing tests: `src/http/settlement.test.ts` (the 500 ms deadline tests; once "expected 4 to be 8") and `src/payout/ready-seed.test.ts` ("seeds two communities in the same millisecond", 5 s timeout). Alone, `settlement.test.ts` failed 1 of 10 runs. The recorded gate is the green run. Not fixed: they are `main`'s API tests, frozen until Oct 7.

## Open questions for Cisco

1. **The Jev question set.** Write the Sep 30 note (`13 Jev Question Set`); the next session then builds 2b, runs 2c and writes 2d. **Recommended:** in the same session as the Oct 2 close check, so Jev and both Sonnet runs use one day's models.
2. **Rubric 1.3.0 still promises strikes** ("first = warning, second = … third = 30 days out"), and strikes are not built. 1.3.0 is already public in `hyphae-program`. **Recommended:** publish 1.3.1 without that sentence before the O4 proposal, point `mycel-rules-2` at 1.3.1, and sync the public repo; don't edit a version that is already public.
3. **The v2 quiz leaves timing and the one-reply-one-quote limit to the study page**, since every question is a founder-graded example. **Recommended:** keep it; the page and the bot's result both state them.
4. **The page's copy is public.** "Planned for epoch 4, from 2026-10-16, once the change is proposed and accepted" is a statement of the plan. **Recommended:** read `/rules` on a preview before the merge.
5. **Order after the payout:** the API that carries `mycel-rules-2` must be deployed before any epoch opens under 1.3.0; otherwise the bot has no test for the current rules and the gate blocks that epoch (`no_rules_test_defined`). **Recommended:** merge and deploy both branches in epoch 3, then make the O4 proposal.

## Next

After 2026-10-02T00:00Z: step 1 (epoch 1's close, read-only), steps 2b–2d once the question set exists, step 3 with Cisco and the Ledger, then the final handoff with the three receipts.

## Later: Cisco's rulings on the four questions (2026-09-29, about 21:40Z)

Cisco: "Let's do your recommendations."

| # | Ruling | Done |
|---|---|---|
| 1 | Rubric 1.3.1: 1.3.0 without its sentence on strikes, which are not built. It replaces 1.3.0 as the epoch-4 candidate; 1.3.0 stays published as it was. | `9273508` on `feat/rules-v2`: `docs/rubrics/mycel-1.3.1.json` (a core test holds it to 1.3.0 minus that sentence and the version), a changelog entry, `mycel-rules-2` covers 1.3.1 only (an epoch pinned to 1.3.0 now fails closed), `/rules` names and links 1.3.1. Gate: 772 passed + 1 skipped (core 107, web 111, api 554), typecheck 0, Biome clean, `drizzle-kit check` pass, `test:pg` 44/44. |
| 2 | The quiz stays all worked examples; timing and limits stay on the study page. | Nothing to change. |
| 3 | Cisco reads `/rules` on a preview before the merge. | Vercel preview of `9273508`, behind Vercel's login: https://hyphae-po203lhbl-ciscos-projects-c3b3be54.vercel.app/rules |
| 4 | Merge and deploy during epoch 3, after the Oct 9 payout, then the O4 proposal. | Recorded in `docs/HANDOFF.md`; nothing to do before Oct 9. |

**Review round 4** (fresh Codex `gpt-6-astra`, xhigh, over `9273508`): **SHIP**. It confirmed 1.3.1 differs from 1.3.0 only by the version and the strike sentence, eligibility is unchanged for 1.2.0, fails closed for 1.3.0 and requires `mycel-rules-2` for 1.3.1, and every question and page statement still holds. Two minors: this handoff's `main` copy still said 1.3.0 (fixed in the refresh), and a question for Cisco below.

**Parked, one question:** 1.3.1's "What earns zero" still lists "text that reads like an unedited AI draft", but the code caps a mild AI-writing flag at 79, and only the strong cap (40) falls below the 60 floor; the founder's own case 1 credits 70. 1.2.0 and 1.3.0 say the same. Changing the rubric text is Cisco's call, and once 1.3.1 is public it can only change as 1.3.2, so the copy to `hyphae-program` waits for the answer. **Recommended:** fix it in 1.3.1 before it goes public: move the line out of "What earns zero" and say an unedited AI draft is capped at 79, or at 40 when obvious. Then sync. Nothing needs the public file before the merge.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Branches `feat/jev-eval` (`4a4f4ec`) and `feat/rules-v2` (`9273508`) | GitHub `FCisco95/hyphae` | Unmerged; merge during epoch 3. |
| `docs/rubrics/mycel-1.3.1.json` | `feat/rules-v2` | Public copy to `hyphae-program` waits on the AI-draft answer. |
| `docs/rubrics/eval/mycel-synthetic.json` | `feat/jev-eval` | Generated by `apps/api/scripts/founder-grades.ts`. |
| Vercel previews of `4a4f4ec`, `ac1ed17`, `9273508` | Vercel project `hyphae`, behind Vercel's login | Created by the branch pushes. |
| Codex review transcripts, rounds 1–4 | Session scratch only | Verdicts and findings recorded above. |

No keys, credentials, secrets, services, on-chain accounts or scheduled jobs.
