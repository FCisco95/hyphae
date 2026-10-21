# Review results and known limits

Hyphae was independently reviewed by AI reviewers, not a third-party audit. These are curated historical results, not new reviews or a certification. Internal prompts, operator approvals and working notes are private.

| Date | Scope | Result and technical findings |
|---|---|---|
| September 25 | On-chain program and publication pipeline | Three Codex rounds; third approved. The publisher's ability to choose any root remains an explicit custody trust. Full audit manifests are stored off chain and are not yet publicly downloadable. |
| October 3 | Community setup | Claude Opus accepted local/disposable use, requiring production database-target pinning and verified TLS. Both fixes approved in 072e99b..cd4c4ef. |
| October 4 | Read SDK and adopter example | Claude Opus accepted after fixes. Local package verification is not npm publication. |
| October 4 | Raid alerts and member journey | Claude Opus accepted after fixes. Alert delivery remains subject to Telegram and membership checks. |
| October 6 | Wallet linking page | Codex accepted with one advisory, subsequently fixed. Linking requires the wallet's signature. |
| October 6 | reward-eval/2 | Codex found scoring clean and two evaluation-script defects. Both were fixed; the fix was not independently reviewed again. |
| October 11 | Claim recovery, cc4f773 | Claude Opus 5.5 ACCEPT. One picker, visible connected address, bounded waits, cancellation and recheck before retry, and stale-account/epoch guards. Transaction construction unchanged. |
| October 21 | Shared X handle hold, 1273b94..8980899 | Codex: three rejections, fourth round ACCEPT. One X handle per member per community; members already sharing one are not payable for an epoch until an admin clears them. Fixes keep a stored publication intent unchangeable by late hold results or clearances, and end the wait when the hold window closes. A member whose hold stays uncertain past the window still blocks the epoch, as before. |
| October 11 | Private eligibility, f573a68 | Claude Opus 5.5 ACCEPT after correcting stale OpenAPI and Postgres race tests. Public eligibility verdicts removed; private checklist access bound to caller and community membership. Payout and scoring rules unchanged. |

## Tests are not reviews

- [Prompt-injection check](../rubrics/eval/reward-eval-2-injection.md): seven pure injection replies earned zero in all 21 runs. An appended injection had unstable classification; this small test does not prove general resistance.
- [Jev v4 evaluation](../evals/jev-v4-calibration-2026-10-07.md): fixed cases and a partially contaminated holdout, including the remaining misses. It is not proof of general calibration or selection by a live epoch.
- [Release CI](https://github.com/FCisco95/hyphae/actions/runs/38140495535) ran unit, type, lint, Postgres and contract checks. [Released behavior and smoke evidence](2026-10-11-release.md).

## Current material limits

The publisher and upgrade authority remain trusted. Scores are model judgments, not proof of authorship. The scorer reads text, not images or videos. Whole-epoch audit manifests are not publicly downloadable. A stored allocation or transaction signature alone is not proof of payment; the site requires a confirmed chain receipt. See [security and trust](../SECURITY.md).
