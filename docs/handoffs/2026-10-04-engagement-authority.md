# Engagement targets and submission authority — October 4

Last Updated: 2026-10-04T20:14:53Z

## TL;DR

Cisco clarified the intended rule: **the community admin and its authorized council stewards choose the posts for engagement. Members submit evidence of their own engagement with those targets.** Opening the public bot gives no target-creation authority. This ruling is recorded; no permission, intake, reward policy or live configuration changed in this turn.

## Verified current source

Read-only inspection of `apps/api/src/bot/commands/raid.ts`, `submit.ts`, `apps/api/src/bot/index.ts`, `apps/api/src/x/oembed.ts` and `packages/db/src/schema.ts`. These paths are identical between published a646 and current local main.

- `/raid` resolves the registered community by the Telegram chat ID and requires its exact `adminTelegramUserId` before fetching a post or inserting a task. This is one designated administrator, not every bot user or every Telegram admin.
- `/submit` requires the registered community and an existing member. It captures contribution evidence; it does not create an engagement target.
- Council/steward authorization is not implemented in this path/schema. No `/propose` handler is registered; old proposal schema fields are not an active member target-creation feature.
- Linked submissions use the latest open task if one exists; otherwise `taskId` is null and standalone scoring can proceed. Free-form text also takes a standalone path. Therefore membership does not establish that a contribution answers an approved engagement target.
- Current oEmbed capture contains ID, author handle, text and URL, without structural reply-parent/quoted-target identity. Attaching the latest task and a model relevance judgment do not independently verify a reply/quote to its exact target. First-seen handle binding is not independent authorship proof.

## Intended flow and recommendation

1. Community admin or a verified council steward for **that community/mint** creates an engagement task with its target, brief and window.
2. Members read that official task, engage on X and submit the URL of their own reply or quote as evidence. A member's evidence URL cannot become a target for everyone else.
3. Engagement intake requires an explicit approved active task and rejects missing, closed, mismatched or wrong-community targets before scoring. Verify the evidence relation and authorship using an accepted evidence mechanism; missing proof must stay explicit. Give other contribution types an explicit brief/route rather than silently accepting them as engagement.

Council authority needs a verified Organic role contract and binding to the acting Telegram identity. The current allowed Organic interface is public settlement GET and supplies no such role authority. Do not invent a steward allowlist, equate Telegram admin with council membership, infer authority from a leaderboard or write in Organic's repo. Its owner retains task3.6/DEP-09 authority/transport work. This is the nearest dependency for implementing the full admin-and-council rule, not a repeated release approval.

## Evidence stage and preserved release

Static source inspection only; no tests, paid scoring call, bot message, database write, source fix or rollout. Web exact-a646 release remains complete at Vercel dpl_A9BMEHKgNn8r9NtGtJhFWAunPY5q, per `docs/handoffs/2026-10-04-web-release.md`. No new publication is authorized; all later source/docs remain local. Retain the frozen v11 worker, existing epoch/payout dates, separate API and real phone scopes, hidden recruitment until phone PASS, and no empty-payment claim.

## Suggested skills

handoff-memory, security-review for authorization/intake work, karpathy-guidelines for scoped implementation, handoff. organic-sync belongs to its owning vault session.

## Generated artifacts this session

This technical ruling/findings receipt and updates to docs/HANDOFF.md and docs/BUILDLOG.md. No runtime resource or credential generated.

## Next-session prompt

```text
Read docs/HANDOFF.md, docs/handoffs/2026-10-04-engagement-authority.md and docs/handoffs/2026-10-04-web-release.md. Exact-a646 web remains released and accepted; subsequent source is unpublished. Cisco's rule: only community admin and authorized council stewards choose engagement targets; members submit their own engagement evidence. Current /raid is designated-admin-only, council integration is absent, and /submit still allows untargeted work.
Model: Codex Opus 4.8 (high) — authority contract planning per the project routing table; recommendation only.
Skills: handoff-memory, security-review, karpathy-guidelines if implementing, handoff.
Resolve the verified community-scoped council-to-Telegram authority contract with its owning Organic workstream before implementing steward access. Define explicit task/evidence validation without changing the active frozen reward epoch or guessing authorship. No sibling write, full-main publication, API rollout or phone test is inferred.
```
