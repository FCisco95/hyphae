# Hyphae — implementation-planning session handoff

## TL;DR

The user requested a fresh Orca session with a more efficient model to continue Hyphae. Continue in the existing `h-design-2026-09-19` worktree, preserving its ignored private notes. D1–D3/O1–O7 are fully approved; the next task is to scope and write the bounded implementation plan. Source changes and paid evaluation remain outside this task.

## Routing and scope

Selected **GPT-5.6 Terra, high effort** for translating the approved design into bounded tasks. This is the user's efficiency preference applied to this follow-up, superseding the older Astra xhigh recommendation for this session only. It is a cost-conscious routing judgment, not a measured token/credit saving. The local Codex catalog supports this model/effort; [OpenAI's model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra) describes its balance of intelligence and cost. Keep context focused; flag substantive unresolved design questions rather than silently escalating or reopening approvals.

Ownership transfers to the fresh session once its prompt is accepted. The outgoing session then stops. No parallel writers or new worktree are needed.

## Verified current state

- Starting approval checkpoint: `07072fb`; approved design remains exactly as in `c08871f`.
- All 16 reviewed synthetic scores and the full fixture remain unchanged.
- Organic-sync has now applied full approval to its private canonical spec/plan, board and contract, and archived the private approval amendment. Verified by reading its `10 - PROJECTS/Organic/reports/organic-sync/2026-09-20-h-design-approval-sync.md` and current Integration Board. This is private documentation propagation, not implementation or deployment.
- The approved design's old awaiting-review wording is historical; the written approval record supersedes it.
- Keep the separate dirty main checkout and all other workers' files untouched.

## Acceptance for the new session

Write a bounded, dependency-ordered implementation plan in the ignored local private planning mirror, with precise future file ownership, acceptance tests, migration/rollback considerations, and explicit contract blockers. Preserve existing task IDs where practical and identify the first safely implementable slice without executing it. Include persistent slot counters, strict cutoff, exact/whole points, frozen configuration, effective correction lineage, and the `/me`/mutable-rubric gaps. Return private-plan amendments and a concise engineering receipt to organic-sync; keep private strategy out of public Git.

## Suggested skills

`handoff-memory`, `orca-cli`, available implementation-planning guidance, `handoff`. Use targeted source reads and existing decisions; avoid repeating discovery or approval.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Continuation prompt / dated handoff | `docs/handoffs/2026-09-20-implementation-planning-session.md` | This file |
| Updated current handoff | `docs/HANDOFF.md` | Planning continuation and verified sync state |
| Fresh Orca Codex session | Existing H-DESIGN worktree | Handle and send receipt recorded below |

## Session receipt

Fresh Codex session launched in Orca and focused. Worktree ID: `37460600-caa8-4415-ad1a-d80c1a0588db::/Users/cisco/orca/workspaces/hyphae/h-design-2026-09-19`; terminal handle: `term_5f829d61-0dc2-4817-8ec6-4feaff040d8f`; title: `Hyphae planning - Terra high`. Runtime handles are local delivery addresses; use the branch and repo-relative files for portable recovery.

The initial new-tab request timed out without producing a new listed terminal. The existing recovery shell was verified idle, renamed, and used to start the fresh session with `codex --model gpt-5.6-terra -c model_reasoning_effort="high"`. `tui-idle` returned `satisfied: true`; terminal output confirmed `gpt-5.6-terra high`, the correct worktree, and Ready. No second agent was created.

This checkpoint is saved before prompt submission to avoid concurrent handoff edits. The outgoing session submits the exact prompt below and reports the acceptance receipt in chat, then stops. No new credentials, deployments or paid scoring evaluations.

## Next-session prompt

```text
Continue Hyphae by scoping and writing the implementation plan for approved D1-D3 and O1-O7. Work in the existing h-design-2026-09-19 worktree; starting approval checkpoint 07072fb. Full written approval is recorded: do not reopen it or regrade the 16 synthetic cases.

Files: CLAUDE.md, docs/HANDOFF.md, docs/handoffs/2026-09-20-h-design-written-approval.md, docs/handoffs/2026-09-20-h-design-operational-definitions.md, docs/rubrics/eval/mycel-synthetic-review.json
Model: GPT-5.6 Terra (high) — user-selected efficiency preference; bounded planning from a fully approved design.
Skills: handoff-memory, orca-cli, available implementation-planning guidance, handoff.

Read the private canonical design/implementation plan at the locations in CLAUDE.md, focusing on current amendments and relevant task sections. Organic-sync has applied the approval; its private 2026-09-20-h-design-approval-sync report confirms this. Read existing ignored private amendments only as needed. Use targeted source inspection, not whole-repo rereads.

Own only local handoff/design notes and the ignored docs/plans planning mirror. Produce the complete bounded implementation plan: dependency order, precise future files/ownership, acceptance tests, migration/backfill and rollback considerations, explicit blocked contracts, and the first safe implementation slice. Cover persistent slot/candidate/dispatch counters, ordinary-to-effort upgrade, strict close/late-result/re-entry handling, indexed config cooldown, exact versus whole points, effective correction lineage and logical commitments; account for /me summing all runs and workers reading mutable community rubrics. Map to existing canonical task IDs where practical. Do not silently invent or approve missing contract decisions.

Preserve the approved design and all 16 fixture labels/bytes. No source or fixture edits, paid evaluation, database changes, deployment, push, or sibling writes. H-CONTRACT wire/auth/hash vectors, fees/funding/payment, campaign, Sentinel adoption and H-FIXTURES range rules remain separate gates. Do not start another writer or escalate models automatically; report a substantive unresolved question if one prevents a correct plan.

Finish the plan and validate its references/coverage without running product tests for notes-only work. Refresh docs/HANDOFF.md plus a dated snapshot, record actual model/effort and evidence stage, and return the local private-plan amendments to the existing organic-sync owner via orca-cli. Stop before implementation.
```
