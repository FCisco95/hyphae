# H-DESIGN — approved and open reward decisions

## TL;DR

Recovered reviewed `727818b960f6db58de82b4f54268b0c8724d0c96` in the isolated `h-design-2026-09-19` worktree; dirty Mac main is preserved. The founder explicitly approved D1 (AI eligibility and slot handling), D2 (public corrections and close-time cutoff), and D3 (0–100 quality for every format) in this session. This completes the three H-DESIGN policy decisions, not full implementation approval.

All 16 synthetic examples remain reviewed and unchanged. The prior founder checkpoint is `docs/handoffs/2026-09-19-founder-calibration-and-reward-design.md`.

## Approved baseline carried forward

| Area | Existing ruling |
|---|---|
| Product | Contributions → points → epoch treasury allocation. No task-bounty redesign. |
| Quality versus effort | Quality is 0–100; substantial effort changes points independently. |
| Epoch and slot | Seven days; one evaluated high-effort submission per member per epoch. |
| Multiplier | Default 3×, community-configurable, only after hard-zero gates and credited quality ≥60. |
| Configuration | Multiplier, limit and epoch duration are public and auditable in the epoch configuration/hash. Active settings are immutable; changes take effect at a future boundary with a two-epoch cooldown. |
| Hard zeros and AI-writing caps | `guideline_breach`, `spam`, `off_topic` → zero. Mild AI-writing cap 79; strong cap 40, then the 60 floor. Strong means template rhythm or at least three structured patterns. Effort cannot rescue a zero. |
| Timing | Existing MYCEL v1 encoding: full credit for six hours, linear decay to zero at 48 hours; applies after crediting. No-task work currently has timing factor 1. |
| Ordinary intake | One reply and one quote per member per task, across up to three bound X handles. Duplicate guards continue. High-effort eligibility does not create extra reply/quote permissions. |
| Hold/caps/start | 100,000 MYCEL minimum hold; per-wallet pot cap 25% below 20 paid contributors and 15% thereafter; first paid epoch opens after the rules test and raid flow are live, earlier buckets retained. These are approved policy, not a claim all enforcement exists. |
| Other safeguards | Rules-test gate, copycat/strike policy, proposal threshold 70 and no credited likes/reposts in v1 remain in the private approved brief/plan; this session does not replace them. |
| Fee | 3% of the settlement pot before contributor allocation remains the ruled rate. Gross/net meaning, rounding, recipient, funding and proof of payment retain their separate contract gates. |
| Quality policy | Useful criticism and praise have equal opportunity. No engagement-metric/bullishness bonus. Truthful holder and reward disclosures are allowed; grounded uncertain price reasoning is allowed; unsupported targets, guarantees and directions to others to buy/hold remain breaches. |
| Media | Include essential media in future scorer input; disclose missing evidence and do not invent it or hard-zero a plausible visual reference solely because it is unavailable. |

The source plan and September 19 checkpoint take precedence over older brief wording where later founder rulings supersede it. No historical label is silently rewritten.

## D1 — AI high-effort eligibility: APPROVED

Founder answer this session: “Approve evidence-based AI eligibility (recommended)”. The approved question included all of these terms:

- AI classifies against public criteria for substantial original work and provides supporting evidence, separately from quality.
- A completed evaluation consumes the member's one epoch slot even when rejected.
- Failed retrieval or missing essential media remains pending and consumes no slot.
- Quality gates still apply before 3× points.

Examples from the approved direction: a substantial original contribution post, thread, article, real product/protocol test or video. A format label alone does not prove the work is substantial or original.

Draft criteria for the written design, not a separately approved rubric: meaningful original work; inspectable output/evidence; a substantive community contribution beyond a routine reaction. Do not infer authorship, actual time spent or effort from length, polish, popularity or the contributor's assertion alone. An ordinary contribution failing the effort test is not automatically spam or low quality.

Implementation design still needs an explicit pending/completed state distinct from a false boolean; reservation/idempotency, retry limits and boundary handling must be written before code. D1 does not authorize unlimited retries, an extra slot through another handle, or duplicate credit for the same artifact.

## D2 — public reasoning and correction details: APPROVED

Existing policy already favors public scoring explanations and append-only human corrections, with points provisional until close (private plan W2.17). Founder answer this session: “Approve public audit and close-time cutoff (recommended)”. The approved rule is:

> Publish a concise evidence-based explanation and keep every original decision. Admin changes append old/new values, reason, actor and time. Only changes before epoch close affect that epoch's allocation. After close, corrections can explain mistakes but cannot rewrite its root or payments; compensation remains a separate decision.

The cutoff is epoch close, including the closed-but-not-yet-published interval. Publication delay must not extend the allocation correction window. Corrections after close remain explanatory; no compensation mechanism was approved.

The published explanation should cite observable contribution evidence and criteria. It is a decision explanation, not hidden model deliberation. Publish the authorized actor's stable audit identity; do not expose unrelated private account information. Public API/auth field details belong to H-CONTRACT and the later implementation design.

Recommended invariant: exactly one effective decision per contribution at the allocation cutoff. Keep all superseded rows visible and hash/link the chosen decision and its correction lineage. A correction changes that contribution's effective result; it does not create a second contribution, restore a consumed slot, or change the epoch's frozen rules. These operational details remain proposed until the written design is approved.

## D3 — ordinary-reply quality ceiling: APPROVED

The historical founder scale capped ordinary replies around 90 and reserved 100 for extra-mile work. The separate effort multiplier reopened that ceiling. Founder answer this session: “Allow 0–100 for every format; reward effort through 3× (recommended)”. This supersedes the old ceiling prospectively.

Exceptional ordinary replies may earn 100 quality. There is no format-specific 90 ceiling. Substantial effort earns its separate multiplier only after the same credit gates. All 16 existing founder target scores and the accepted 75–80 interval remain unchanged; permission to award 100 does not retroactively make existing 90s incorrect.

H-FIXTURES must mark the historical `founderScalePolicy` as superseded while retaining case targets/reasons as review provenance. It still needs an explicit reward-band range-conversion rule; D3 does not invent numerical tolerances or approve paid comparison. New policy/config versions must not regrade settled epochs.

## Epoch invariants to specify before implementation

These clarify the approved direction but are not new founder approvals:

1. Scope the slot to community + member + reward epoch, across all linked handles; one contribution has one effective points result. Pending reservations must prevent simultaneous evaluations from spending several calls for one slot.
2. Freeze the epoch configuration at opening. Preserve rubric/eligibility criteria, multiplier, slot limit, duration and effective version/hash so the same evidence can be recomputed. Quality and credited score must remain distinct from weighted points.
3. State cooldown indexing with an example. Proposal: activation at E11 fixes that config for E11 and E12; earliest subsequent activation is E13. Earliest activation must satisfy both the next-boundary rule and the cooldown. No boundary gaps/overlaps when future duration changes.
4. Preserve gate order: hard-zero/AI-writing caps → 60 floor → existing timing and effort factors → epoch aggregation → allocation/caps. Specify exact points rounding once; money uses integer lamports. At full timing, clean quality 85 yields 255 points when eligible; quality 59 or a hard breach yields zero even when effort is eligible.
5. Define what happens to an evaluation still pending when its epoch closes. D1 forbids consuming the slot for missing evidence; it does not decide a later settlement epoch or authorize reopening a closed allocation. No silent rollover or backdating.
6. Select one effective run deterministically at the correction cutoff. A post-close explanatory correction must be distinguishable from the decision actually committed to the epoch. Preserve historical hashes/roots/claims; any compensation mechanism needs its own decision.

## Source findings affecting the later design

- `packages/core/src/score.ts`: quality output is 0–100; `creditedScore()` enforces caps and hard zeros; no effort classification or multiplier exists.
- `apps/api/src/jobs/score.ts`: `output.score` is raw quality; stored `scoring_runs.score` is credited quality; timing is separate. It reads the community's current rubric, so a future epoch-pinned configuration needs explicit selection/provenance.
- `packages/core/src/settle.ts`: `scoreSum` currently describes timed scores. Future weighted points must not silently redefine consumer `lastScore` as a number that can exceed 100. The supplied pot is allocated; protocol-fee deduction is not implemented there.
- `apps/api/src/bot/commands/me.ts`: currently counts/sums all scoring runs for the member, without an epoch filter or effective-run selection. Later correction support must not double-count runs. This finding was recorded, not fixed.
- `packages/db/src/schema.ts`: historical runs have no supersedes/correction linkage, effort decision or frozen reward-config fields. Existing append-only comments are intent, not proof of a complete enforced correction flow.
- `apps/api/src/server.ts`: only health and Telegram routes are registered. A design approval does not make HY-1…HY-6 available.
- Synthetic JSON has stale top-level `awaiting-founder-labels` metadata despite 16 reviewed cases; cleanup belongs to H-FIXTURES. Fifteen numeric range conversions remain unapproved.

## Receipt for organic-sync

- Task/stage: H-DESIGN; local design notes on `h-design-2026-09-19`, based exactly on reviewed `727818b960f6db58de82b4f54268b0c8724d0c96`. No new commit/PR/release/deployment.
- Actual runner: GPT-6 Astra, xhigh, observed in the active Orca Hyphae terminal; user-authorized alternative. No escalation or sub-agents. Session cost unavailable; paid scoring-evaluation calls: 0.
- New approvals: D1, D2 and D3 as recorded above, each explicitly answered by the founder. Full implementation design and implementation are not approved.
- Private-plan amendments: proposed locally at `docs/plans/h-design-private-amendments-2026-09-19.md`, ignored by Git. Vault sync is the sole writer of canonical plans/board/contract. No sibling files were edited.
- Organic impact: H-CONTRACT must distinguish raw/credited quality, weighted points, correction status and epoch config provenance. Organic must consume provider results, not apply its own multiplier. Existing honest unavailable routes remain valid; allocation/root/points do not prove payment.
- Sentinel impact: no verification/auth change. Holder evidence and wallet proof do not approve a reward, establish Organic membership, or define an epoch. SDK adoption retains S-VERIFY/S-PACK/authorized S-RELEASE and Hyphae persistence/auth design gates.
- H-FIXTURES gate: D3 is resolved; an explicit reward-band conversion rule remains. Preserve labels; keep synthetic and real examples separate. No paid comparison authorized here.
- Checks: source/ref/status review; JSON parse and 16 reviewed labels confirmed. `git diff --check` passed; handoff validator reports resume-usable. Source/fixture diff against reviewed HEAD is empty; restored private founder notes match the archive byte-for-byte and are ignored; all three dirty-main file fingerprints and original HEAD/status match. Historical 75-test transfer result is not a fresh test run.
- Next gate: consolidate these approved policies in the private plan, complete the remaining operational definitions, and obtain full written design approval before implementation planning. Stop before reward code or paid evaluation.
- Delivery: the existing organic-sync vault terminal accepted this receipt. Its processing and canonical private-plan application are not yet verified; no sibling writes were performed by this worker.

## Suggested skills

`handoff-memory`, `orca-cli`, `handoff`. The receiving vault owner can invoke organic-sync post-ship to reconcile these notes; this worker does not perform that cross-repo write workflow.

## Generated artifacts this session

See `docs/HANDOFF.md` for the recovery worktree, canonical handoff, this snapshot and the two ignored private notes. No credentials or deployed resources created.

## Next-session prompt

```text
Resume Hyphae from the recovered h-design-2026-09-19 branch. D1 AI eligibility/slot handling, D2 public append-only corrections with an epoch-close cutoff, and D3 0–100 quality for every format are approved. Keep all 16 reviewed synthetic scores unchanged.

Files: docs/HANDOFF.md, docs/handoffs/2026-09-19-h-design-open-decisions.md, docs/handoffs/2026-09-19-founder-calibration-and-reward-design.md, docs/rubrics/eval/mycel-synthetic-review.json, CLAUDE.md
Model: GPT-6 Astra (xhigh) — user-authorized runner for reward/epoch design.
Skills: handoff-memory, orca-cli, handoff.

Preserve the approved decisions and return the record/private-plan amendments to organic-sync. The next authorized design task should complete the open operational definitions before requesting full written design approval. Stay within local design/handoff notes. No reward code or paid evaluation.
```

## Follow-up — 2026-09-20

D1–D3 above remain approved and unchanged. The operational questions now have a complete proposed answer in `docs/handoffs/2026-09-20-h-design-operational-definitions.md` (O1–O7), awaiting full written approval. Use `docs/HANDOFF.md` for current verification/delivery state. The earlier receipt and private amendment remain historical records; they do not approve the new proposal.
