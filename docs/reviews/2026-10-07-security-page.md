---
date: 2026-10-07
summary: Independent Codex fact-check of the security and trust page (docs/SECURITY.md and apps/web/lib/trust.ts, db454d4): NEEDS-FIXES with four medium and two low findings; five fixed in d87ca7a and accepted on a fix check, one (reporting channel not enabled) handled by enabling it before the push.
---

# Security and trust page: Codex fact-check

Reviewer: Codex `gpt-6-astra`, reasoning effort xhigh, read-only sandbox, ephemeral session; another model family than the builder (Claude Opus 5.5). Asked to check every bullet of `docs/SECURITY.md` against the code and docs it links and report only false claims, overclaims, omitted material trust facts and links that do not support their sentence.

## First pass on `db454d4`: NEEDS-FIXES

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Medium | "One epoch's pot is what is exposed" overstates the cap: unclaimed SOL stays in the vault, and the same Ledger can upgrade or close the program. | Fixed in `d87ca7a`: the sentence now says funding one epoch at a time limits exposure, and that the Ledger's control reaches everything still in the vault. |
| 2 | Medium | The page sends reports to GitHub private vulnerability reporting, which reads `{"enabled":false}` on `hyphae-program`. | Not a text change: Cisco enables it, and the agent checks the API reads `{"enabled":true}`, before the page is pushed. |
| 3 | Medium | The deletion promise omitted what stays public: the wallet verified at an epoch's close stays on its receipts, wallet-link history is kept, and contribution links name the X account. | Fixed in `d87ca7a`: the retention sentence now lists what receipts keep. |
| 4 | Medium | The page omitted that X ownership and the reply/quote relation are not verified (`apps/api/src/bot/commands/handles.ts`, `raid_submission_receipts` in `packages/db/src/schema.ts`). | Fixed in `d87ca7a`: a new claim under "What you trust" says both are recorded as unverified and a score is not proof of authorship. |
| 5 | Low | Vercel forwards visitor IP addresses to the API for rate limiting; undisclosed. | Fixed in `d87ca7a`, with `apps/api/src/http/rate-limit.ts` as evidence. |
| 6 | Low | The fee-address sentence tied 2026-10-08 to "the first payout"; the payout can only follow the Oct 9 00:00Z close. | Fixed in `d87ca7a`: the address is fixed at community creation, planned for 2026-10-08. |

## Fix check on `d87ca7a`: ACCEPT

"Findings 1, 3, 4, 5 and 6 are correctly fixed in `d87ca7a`. No new overclaim or false statement found in the revised text."
