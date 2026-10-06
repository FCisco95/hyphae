---
date: 2026-10-06
summary: What changed in Hyphae on 2026-10-06 that the Organic / vault side needs for tomorrow morning's organic-sync, with the decisions made, the stale claims to correct, and the ready prompt. Written from the Hyphae repo only; no sibling repo or vault was written.
---

# Organic-sync brief (for the morning of 2026-10-07)

From: Hyphae session, Windows, Claude Sonnet 5.5 (effort high). To: the Organic / Brain `organic-sync post-ship` run. Sources of truth in this repo: [HANDOFF](../HANDOFF.md), [ROADMAP](../ROADMAP.md), [BUILDLOG](../BUILDLOG.md) (entries dated 2026-10-06). Engineering truth comes from this repo's code and receipts; the vault reconciles plans and claims against them. This brief writes nothing outside the Hyphae repo.

## What changed on 2026-10-06 (all live unless noted)

| Change | Evidence |
|---|---|
| Wallet-link page redesigned (branded, mobile first, shows the signing address and exact message, separate "did not connect" and "not signed" messages) and a Telegram "Wallet linked" notice with a "Check my setup" button after a verified signature | [link release record](../demo/2026-10-06-link-release-plan.md), [Codex ACCEPT](../reviews/2026-10-06-link-page.md) |
| Scorer loosened: new prompt `reward-eval/2` (rubric 1.2.0 unchanged). Reason: the scorer graded a sincere on-theme reply 58 although the published rubric rewards a genuine take on the theme | [scoring release record](../demo/2026-10-06-scoring-release-plan.md), [calibration](../rubrics/eval/reward-eval-2-calibration.md), [Codex review](../reviews/2026-10-06-reward-eval-2.md) |
| API machine **and worker** now run image `scoring-6b2a4e3` (`sha256:def68189a1e16ffbc062c68ca3ad7e923824dc64a122b5a48f47d09fc433142f`); the worker is no longer frozen on the Oct 2 image | scoring release record, Fly reads |
| One config proposal pending: prompt `reward-eval/2`, earliest activation **epoch 3 (2026-10-09T00:00Z)**. Epoch 2 stays pinned to `reward-eval/1` | `docs/demo/proposal-check.mts` |
| Roadmap of five ranked next steps accepted; handoff reorganized (old text kept in an archive) | [ROADMAP](../ROADMAP.md) |

## Contract impact for Organic

- **Read API shape: no change.** The public `/v1/...` responses keep their schema.
- **New value to accept:** `config.prompt_version` is `reward-eval/1` for epochs 1 and 2 and becomes `reward-eval/2` from epoch 3. Any adapter or page that hard-codes `reward-eval/1` must accept both. The rubric version stays `1.2.0`.
- **Scoring behavior from epoch 3:** an own-words reaction related to the post or the project earns at least 62, promoting the raid's own project is not off-topic; hard zeros, AI caps and the 60 floor are unchanged. Describe it that way to members; do not promise a score.
- **Link flow:** unchanged contract (`/link/request`, `/link/verify`, `/link/status`); only the page and the Telegram notice changed. The page origin is still `hyphae-api.fly.dev`; a Hyphae-owned domain is a roadmap decision for Cisco (the signed message is bound to the origin).
- **Telegram:** the Hyphae Lab group is now a supergroup; its chat id is `-1003934645546`. Anything in the vault holding the old group id (`-5425379598`) is stale.
- **Steward / council role contract (Organic task 3.6, DEP-09):** still the one open dependency from Organic's side. Today's designated-admin fallback is intentional; no invented allowlist.

## Stale claims the vault should correct

1. "Worker frozen on `sha256:1c2d6dd5…` through Oct 12": no longer true; both machines are on `sha256:def68189…` since 2026-10-06T20:24Z. The old digest is the worker rollback target until epoch 3 opens.
2. "Scorer strictness is a rubric matter": the fix was the prompt (version 2), not the rubric. The rubric did not change, so no one retakes the rules test.
3. "Epoch 2 scoring may be loosened": it cannot be; pinned and hashed. Earliest change is epoch 3.
4. Hyphae Lab chat id (above).
5. "First real tester failed to link": he linked successfully (signed 2026-10-06T10:26Z); the page and Telegram gave no confirmation. Fixed.

## Decisions made on 2026-10-06 (Cisco's words in the session; reasoning in the build log)

- Loosen the scorer "a lot"; project mentions in a reply are reach, not promotion. Applied through a new prompt version for epoch 3, not by editing epoch 2.
- Release the scorer and the worker together (scoring runs in the worker); Cisco's exact yes was given for plan `6b2a4e3`.
- Accepted roadmap items 1 to 5 (real members in epoch 3; easier wallet linking; security and trust page; prompt-injection eval; a Solana Action).
- Recommendation not yet decided: a Hyphae-owned domain for the link page; embedded-wallet logins (Privy and similar) are not the default because a fresh wallet carries no history or MYCEL.
- Unchanged: reward, epoch, payout and rubric rules; Oct 8 to 9 first-payout sitting; deploy hold Oct 8 22:00Z to Oct 10 00:00Z.

## Open items for Cisco (owner-visible)

1. Phone test of the link page from a real `/setup` (Phantom or Solflare browser).
2. Approval for real members after Oct 9 00:00Z; the domain purchase and `LINK_ORIGIN` secret change; the Blink go or cut by Oct 8 12:00Z.
3. A security contact address and retention wording for the trust page.
4. `hackathon@colosseum.com` as a collaborator on the private repo; Neon password rotation after Oct 10 00:00Z.

## Ready prompt for the Brain terminal

```text
/organic-sync post-ship
Source: the Hyphae repo handoff docs/handoffs/2026-10-06-organic-sync-brief.md, docs/HANDOFF.md and docs/ROADMAP.md (read them, do not write to the Hyphae repo).
Reconcile the vault's Hyphae and Organic notes with: the 2026-10-06 link-page and scoring releases, the pending epoch 3 proposal (reward-eval/2 from 2026-10-09T00:00Z), the worker no longer frozen, the new supergroup chat id, and the accepted roadmap items 1 to 5. Correct the five stale claims in the brief. Keep the strategy and judging reasoning in the vault; the Hyphae repo carries only engineering facts. Preserve history and approvals; mark anything unverified. Do not change reward, epoch, payout or rubric rules.
```
