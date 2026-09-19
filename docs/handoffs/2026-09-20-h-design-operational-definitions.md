# H-DESIGN — operational definitions for written approval

## TL;DR

D1–D3 remain approved. This document completes the remaining reward/epoch operational definitions as a **proposal awaiting full written design approval**. O1–O7 below are a single reviewable design; they are not new founder rulings or implementation authorization. The September 19 authority record remains `docs/handoffs/2026-09-19-h-design-open-decisions.md`.

Recommended behavior: reserve a member's slot before evaluation; bound evidence retrieval and model dispatch; keep incomplete work distinct from rejection; freeze results at the scheduled close; allow no automatic carry-forward; apply one effective decision per contribution; preserve precise points separately from quality and integer claim points.

All 16 reviewed synthetic scores, reasons, flags and the accepted 75–80 range remain unchanged. No fixture conversion, reward code, paid evaluation, database write or deployment is part of this work.

## Authority and review scope

| Status | Rules |
|---|---|
| Already approved | Seven-day epochs; one evaluated high-effort submission per community member per epoch; configurable 3× after hard-zero/AI-writing caps and the 60 credit floor; public immutable epoch settings; future-boundary activation and two-epoch cooldown. |
| D1 approved | AI judges substantial original work against public criteria, separately from quality. Completed evaluations consume the slot even if rejected. Retrieval failures or missing essential media remain pending without consuming it. |
| D2 approved | Public evidence-based explanation; append-only admin corrections retain old/new values, reason, actor and time. Only pre-close corrections affect that allocation. Post-close explanations cannot rewrite roots or payments; compensation is separate. |
| D3 approved | Every format may receive 0–100 quality. Effort changes points separately. Prior labels remain historical grading evidence. |
| Proposed here | O1–O7: exact criteria, reservation and retry rules, cutoff treatment, cooldown indexing, rounding, effective-decision selection and commitments. |
| Separate gates retained | H-FIXTURES ranges, paid comparison, H-CONTRACT wire/auth agreement, Sentinel adoption, funding/fee/payment evidence, campaign eligibility, implementation and release. |

Existing hold, rules-test, timing, reply/quote limits, copycat/strike rules, caps, first-paid-epoch condition and 3% fee rate remain as recorded in the September 19 decision record/private plan. This proposal does not reinterpret fee language, choose a funding route or authorize a paid epoch. It specifies contribution points and the cutoff inputs to settlement; deployment of a complete payout system still needs those separate contracts.

## O1 — substantial work and sufficient evidence

The public effort criteria require all three: **original substance**, **inspectable work**, and **a concrete community contribution beyond a routine reaction**. A thread, article, post, test or video can qualify; its format alone cannot. An unusually substantive reply can also qualify on the same evidence. Length, polish, claimed hours, views, holding tokens or bullish sentiment are not proxies for effort or authorship.

| Work | Minimum evidence to judge the claim |
|---|---|
| Post, thread or article | Captured relevant content and context, attribution/source links, and identifiable original explanation, analysis or work. |
| Product/protocol test | What was tested, method/steps, observed results and inspectable supporting output. A success claim alone is insufficient. |
| Video or visual work | The actual relevant media plus usable context/transcript where needed. A title, thumbnail or transcript cannot stand in for unseen visual claims. |

Essential evidence means evidence whose absence could change quality, a hard-zero decision, or effort eligibility. Its absence produces `pending_evidence`, with a specific missing-evidence reason, not `highEffortEligible=false` or a fabricated quality zero. Missing optional material can be disclosed while judging sufficient evidence. Once the supplied work is inspectable, failure to demonstrate substantial original work is a completed **ineligible** judgment, not endless pending work.

The completed decision includes raw quality, structured flags/AI-writing signals, derived credited quality, an independent effort true/false result, criteria hits and a concise public explanation citing captured passages, timestamps or test evidence. It does not claim to know hidden authorship or publish model deliberation. Quality and effort must not depend on each other: ordinary excellent work can score 100; substantial work with credited quality below 60 still earns zero.

## O2 — identity, nomination, reservation and bounded attempts

The slot key is `(community, stable Hyphae member, reward epoch)`, across all linked handles. The contribution identity is the canonical artifact in that community, not the submitted URL spelling, Telegram message or queue job. URL aliases, retries and an ordinary/effort nomination of the same artifact refer to one contribution. Handle changes never reset quota. A wallet change must not produce another member/slot or another settlement row; account migration requires the separate identity/auth design. Identity uncertainty blocks allocation, rather than inventing an Organic/Sentinel identity mapping.

Effort evaluation is explicitly nominated by the member. For new work, quality and effort are judged together using one authorized model dispatch. Ordinary submissions do not automatically spend the effort slot. An already scored ordinary contribution can be nominated only in its original, still-open epoch: reuse its captured evidence, quality and credit gates; evaluate only effort against the same frozen rules. This consumes the same slot and replaces the contribution's effective points result if successful. It never adds a second reward or silently changes quality. Any quality revision uses O6's correction path.

Reservation and consumption are different. Admission atomically checks the immutable epoch limit and reserves capacity so `consumed + active reservations <= limit`. The default limit is one. Preflight format/access/rules-test/duplicate checks precede reservation and model dispatch. A deterministic content judgment under the frozen rubric, such as proven copycat spam, counts as a completed rejection if the nomination has been admitted; a malformed URL or duplicate delivery does not.

| State | Capacity and permitted next step |
|---|---|
| `pending_evidence` | Reserved, not consumed. Retrieve essential evidence within the bounds below; show the missing item. |
| `ready` / `evaluating` | Same reservation; one worker owns a fenced attempt. No parallel dispatch and no candidate replacement while a request is in flight. |
| `pending_reconciliation` | Provider outcome is unknown, invalid or not durably stored. Keep reservation; recover the original outcome without a new paid dispatch. Not a false eligibility result. |
| `completed_eligible` / `completed_ineligible` | Atomically append decision and convert reservation to consumed, even for quality zero or an effort rejection. No refund or resubmission to fish for a better result. |
| `withdrawn` before dispatch | Release reservation. Keep all attempt history and spent retrieval allowances. A completed or possibly dispatched request cannot be withdrawn to reset capacity. |
| `expired_at_close` | No new reward decision for that epoch. Record the pending reason and dispatch state; O3 governs recovery. |

**Proposed v1 attempt bounds:** each configured slot has a persistent ordinal and permits at most three distinct candidate artifacts before completion; across the member/epoch this is at most `3 * slotLimit` nominations (default three). Each artifact permits at most three free retrieval rounds (initial, then after 1 minute and 5 minutes from the preceding failed round). A round fetches the declared bounded evidence bundle; pagination/assets cannot create an unlimited recursive fetch. No automatic paid retrieval fallback. Stop sooner at epoch close; user retries, URL aliases, withdrawals and reservation replacement do not reset the slot ordinal's counters. Exhaustion stays pending until withdrawal or close; it is not an ineligible evaluation.

At most one possibly billable model dispatch per reserved slot in the epoch; default one slot means one dispatch per member/epoch in this lane, including failed/malformed/unknown responses. Extra network sends are allowed only when the provider can demonstrably replay the same operation without another execution/charge, or non-dispatch is proven. Otherwise an uncertain response waits for reconciliation; there is no automatic second model call. This is a conservative spend rule proposed here, separate from D1's completed-evaluation count. It does not apply a new quota to unrelated ordinary scoring.

Admission and completion use durable idempotency keys and an atomic decision/consumption write. Duplicate messages/jobs return the existing state. A stale worker cannot finalize after its reservation generation changes. A crashed worker resumes the same attempt, never assumes that an expired worker lease means the provider was not called. Notifications retry independently of scoring. Generic forced re-scoring cannot bypass this path; admin correction is public and does not grant a new slot or model budget.

## O3 — epoch membership, strict close and unfinished work

Each epoch is the half-open UTC interval `[opensAt, closesAt)`, initially 604,800 seconds. Server-side durable intake assigns the contribution's epoch; task/post creation and worker completion do not. A submission exactly at close belongs to the next epoch, subject to the task's own intake window and duplicate rules. An existing contribution's epoch never changes when requeued or nominated. Task timing still measures original accepted submission against task opening, not when scoring eventually runs.

The authoritative cutoff is the **scheduled** `closesAt`, regardless of cron delay, publication delay or service downtime. To affect allocation, a completed decision/correction must have been durably accepted before close. Client time, worker start time, transaction-start time and a backdated `created_at` are not acceptance evidence. The later implementation must establish and test this durable ordering; a boundary transaction whose pre-close acceptance cannot be proved is excluded. A response reaching the model worker before close but not durably accepted until after it is late.

| At close | Frozen result and subsequent treatment |
|---|---|
| New work lacks essential evidence or has no completed quality decision | No contribution points allocated. Retain `pending_at_close` as the reason; do not invent a quality zero or consume a missing-evidence slot. |
| Ordinary result completed, but effort upgrade is pending | Keep the ordinary effective result at 1×, if otherwise eligible. No 3× without a completed eligible effort decision. |
| Completed decision/correction accepted before close | Use exactly the O6-selected result and frozen configuration. |
| Model request still in flight or outcome uncertain | Freeze it as pending; reconcile only the original request afterward. Never dispatch a close-time retry or give it the next epoch's slot. |
| Correction or model completion accepted at/after close | Public late/explanatory entry only; zero change to the frozen allocation, root, claim or previously allocated points. |

A valid evaluation recovered after close is marked `completed_after_cutoff`: it consumed the **origin epoch's evaluation opportunity** and is permanently ineligible for another paid evaluation of that artifact. This append-only operational fact does not alter the frozen slot/result snapshot or charge the next epoch. Retrieval failure alone remains unconsumed. Late completion of an ordinary upgrade leaves the closed epoch's 1× allocation intact.

**No automatic carry-forward.** A contributor may explicitly nominate an expired artifact in a later epoch only if no evaluation ever completed and the earlier attempt is proven terminal with no provider request in flight or unknown. Link the earlier record; preserve its frozen exclusion. The new attempt uses the new epoch's slot, spend bounds, evidence and rules. A prior completed ordinary quality evaluation counts as completed for this rule, so an unfinished effort upgrade cannot reuse an already credited artifact next epoch. Newly substantial work must be a genuinely distinct contribution, not a repost. If an earlier outcome remains uncertain, re-entry stays blocked; no compensation is inferred.

Close is idempotent: freeze a contribution-membership list, effective-decision selections and pending/exclusion reasons once. A failed close job retries that same input snapshot. It must not query today's latest runs to regenerate a different result. Next epochs follow their scheduled windows even if closing/publishing falls behind; an outage does not shift epoch boundaries or create overlap. The existing first-paid-epoch prerequisite still applies.

## O4 — configuration activation and cooldown

Every epoch pins an immutable public configuration payload/version/hash at opening: complete quality rubric/guidelines and credit gates; effort criteria; multiplier and slot limit; attempt policy; duration; timing function; points representation and rounding; applicable hold, strike, weighting and cap policies; and the contribution/decision commitment versions. The epoch manifest separately binds its actual opening/closing timestamps to that configuration; a new epoch window is not a policy activation. Pin the scoring policy/prompt version; record the actual model identifier and prompt/input/output hashes per run. A new rubric, effort rule or emergency proposal cannot silently change the active epoch.

The reward configuration is one versioned bundle. Changes cannot evade cooldown by editing different fields. For a proposal accepted during E(k), with the last activation at E(a), earliest activation is `E(max(k+1, a+2))`. **Activation at E11 fixes the bundle for E11 and E12; the earliest subsequent activation is E13.** Initial activation counts. A no-op payload does not reset the cooldown. Keep one pending replacement; replacing/cancelling it before activation is public and preserves the last actual activation index. A proposal accepted exactly on a boundary belongs to the newly opened epoch and cannot activate there.

Duration changes apply only to the newly opening epoch: `opensAt(E[n+1]) = closesAt(E[n])`; `closesAt(E[n+1]) = opensAt(E[n+1]) + newDuration`. A seven-day E12 followed by a fourteen-day E13 has one shared boundary, with no gap or overlap; cooldown remains counted in epochs, not weeks. Delayed workers materialize the configuration scheduled for each boundary, never today's mutable community settings.

Validate duration as positive whole seconds, slot limit as a positive integer, and effort multiplier as integer basis points at least 10,000 (default 30,000). Reject configurations/results outside the supported integer/claim bounds instead of clamping them. Disabled operation is an explicit intake pause, not a zero-length epoch or a hidden config change. Publishing paused intake does not rewrite rules or extend the correction window.

## O5 — credit, timing and points arithmetic

Keep four values distinct: `rawQuality` (integer 0–100), `creditedQuality` (integer 0–100), exact weighted contribution/epoch points, and rounded whole claim points. Field names here describe semantics, not an approved API schema. An ineligible effort result normally means 1×, not zero quality. Unnominated ordinary work uses 1×. No other format factor is introduced.

Apply hard-zero flags first; otherwise apply the existing mild AI-writing cap 79 or strong cap 40 (template rhythm or at least three structured patterns), then the 60 floor. A capped score below 60 becomes credited zero. Apply timing and effort only afterward. Do not apply the 60 floor again to decayed points.

Proposed deterministic representation, retaining current timing basis-point behavior:

- Let `t` be elapsed integer milliseconds from task opening to original accepted submission. Intake before task opening is rejected; missing task uses timing `T=10000`.
- For MYCEL, `F=21,600,000` (6 hours), `Z=172,800,000` (48 hours). `T=10000` for `t<=F`; `T=0` for `t>=Z`; otherwise `T=roundHalfUp(10000*(Z-t)/(Z-F))`, using integer/rational arithmetic. Freeze these curve values per epoch.
- Let `M=30000` for a completed eligible nomination under the default config, else `M=10000`; substitute that epoch's configured integer multiplier when changed.
- `pointUnits = creditedQuality * T * M`, with `100,000,000 pointUnits = 1 point`. This product and aggregation are exact integers; do not round per contribution.
- Sum only effective contributions for the member/epoch. Whole claim points are `floor((sumPointUnits + 50,000,000)/100,000,000)` (nonnegative half-up), once after aggregation. Show exact weighted totals and whole claim points distinctly. For example, two 0.5-point contributions mint 1 point, not 2.

MYCEL `stakeWeight=none` uses the exact aggregate point units for proportional allocation before the existing per-wallet cap. Whole claim-point rounding must not change a wallet's allocation weight; a positive fractional total can receive an allocation while minting zero whole points. Money uses integer lamports; final proportional allocation floors, and capped remainder/dust stays retained as in the existing settlement direction. This does not select gross/net pot semantics, fee rounding or a payment route. Other communities' optional square-root stake weighting needs its own exact arithmetic contract before activation; do not silently reuse floating-point stake conversion as a verified guarantee.

Member eligibility/exclusion and applicable strikes can remove or zero a member's settlement weight after contribution aggregation. Keep earned contribution decisions visible alongside the exclusion reason. Hold evidence and cap-population/payment definitions must come from the separately approved settlement contract, not be inferred from these points. Do not publish a paid allocation if required settlement inputs remain undefined or unverified.

| Case at full timing unless stated | Credited quality | Weighted points |
|---|---:|---:|
| Clean quality 85, eligible effort | 85 | 255 |
| Clean ordinary quality 100, no nomination | 100 | 100 |
| Quality 85, effort rejected | 85 | 85; slot consumed |
| Quality 59, eligible effort | 0 | 0; slot consumed |
| Quality 95, hard breach, eligible effort | 0 | 0 |
| Quality 95, mild AI-writing cap, eligible effort | 79 | 237 |
| Quality 95, strong AI-writing cap, eligible effort | 0 | 0 |
| Quality 85, eligible effort, 27 hours after task opens | 85 | 127.5; 128 whole claim points if alone |
| Quality 60, 1×, 47h 59m after task opens | 60 | 0.024; not a second 60-floor failure |

These are arithmetic examples, not additional founder-labelled fixtures or model-performance evidence.

## O6 — one effective decision and append-only corrections

Each contribution has a single ordered decision lineage. The first completed decision starts it; subsequent effort completion or authorized admin correction appends a full resulting decision referencing its predecessor. A unique contribution revision is assigned atomically, with an expected predecessor check. Two admins acting on the same revision cannot both silently succeed: the loser must reload/review. The same idempotency key returns the same revision. Wall-clock ties and database row ordering never choose a winner.

An effective correction records the actor's stable public audit identity, authority at acceptance, reason, old/new values, evidence references, accepted time and predecessor hash. Preserve original model input/output and every superseded row. The system derives credit/points again under the frozen config; an admin cannot directly type arbitrary reward points or override a hard flag while leaving it asserted. Correct the underlying classification with a public reason instead. An effort correction must reference the admitted, consumed nomination; it cannot grant an ordinary contribution an unreserved free 3× opportunity. A correction never restores a consumed slot, grants a second artifact credit or changes epoch membership/configuration.

At close, choose the last valid revision in the linear lineage whose durable acceptance is strictly before `closesAt`; retain the selected revision ID and hash in the frozen manifest. A pending upgrade has not superseded the completed ordinary result. Uncompleted ordinary work has no selected quality decision. Duplicate raw model responses and failed/invalid attempts are audit evidence, not competing effective decisions.

After close, append explanations/corrected assessments with `affectsAllocation=false`, referencing the frozen decision and any prior explanatory entry. Display **the result used for settlement** separately from **later corrected assessment**. There is no backdating or special closed-but-unpublished exception. Reversing a pre-close admin mistake requires another pre-close correction; after close, any compensation needs its own approved funding/authorization record and cannot rewrite the old root or claims.

## O7 — commitments, public audit and integration boundary

Logical commitment inputs are explicit here; H-CONTRACT and later implementation own wire fields and shared byte-level test vectors. No existing hash/leaf field is silently redefined. Introduce a new version/domain for these semantics, while preserving historical run hashes and roots.

| Commitment | Required immutable inputs |
|---|---|
| Configuration hash | O4's full payload, including policy/encoding versions. Version label alone is insufficient. |
| Evidence manifest | Captured artifact and essential media hashes, source/attribution, capture time, task context, availability/limitations and stable community/member/contribution identities. Reopening a mutable URL must not change past evidence. |
| Decision hash | Full selected decision, run provenance/input/output hashes, evidence/config hashes, predecessor hash/revision, raw/credited quality, flags, effort/slot reference, timing, exact points, explanation, actor and durable acceptance metadata. A predecessor hash binds the earlier lineage. |
| Wallet/epoch manifest | Community/network and independent Hyphae epoch identity/window, config hash, fixed payout wallet/member mapping, sorted contribution IDs and selected decision hashes (or pending/exclusion reasons), exact aggregate, whole claim points and separately identified settlement inputs. Sort by canonical contribution ID, never retrieval/DB order. |
| Claim evidence hash | Hash of that immutable wallet/epoch manifest. Bind through the claim leaf with wallet, epoch, whole points and integer lamports; preserve the existing leaf encoding unless a separately versioned contract approves a change. |
| Epoch audit manifest | Complete frozen membership, including zero/pending/excluded entries, cutoff ordering evidence, all wallet manifest hashes and snapshot hash; allocation/root/publication references added as separate records. |

Use the repository's sorted-key canonical-JSON approach only with an explicit versioned, restricted payload: UTF-8 strings preserved as captured; no undefined/NaN/floating values; integer quantities and timestamps use canonical decimal strings; hashes use lowercase hex; absent optional values are explicit null; arrays have specified stable order. Domain separation identifies config/evidence/decision/wallet/epoch hashes. Concrete field schemas and cross-language hash vectors are a contract/implementation gate, not permission to invent consumer fields today.

The public audit manifest explains inclusion/exclusion for every admitted contribution. A funded wallet leaf can bind its own manifest; a published allocation root alone does **not** prove completeness of zero/pending entries elsewhere. Unfunded or no-leaf entries have public snapshot evidence only unless a separately approved audit-root anchor is added. Do not claim the whole manifest is on-chain merely because a claim root exists.

Public views expose criteria, input limitations, original and corrected decisions, selected-at-close status, quality, weighted points, whole claim points and the pinned configuration. Keep private account identifiers/auth material out of public payloads; a stable public actor identity suffices. `/me`, leaderboards and wallet APIs must share the same effective-decision selection, not sum every `scoring_runs` row.

Organic consumes provider results and provenance; it must not multiply quality by 3 itself or display weighted points as `lastScore`. Allocation, root publication, available funds and verified claims are separate evidence states. Hyphae epoch indices do not establish Organic epoch equivalence. Sentinel proofs establish only their defined wallet/holder facts, not community membership, reward eligibility or epoch identity. This design provides no public v1 route or SDK adoption approval.

## Review examples and acceptance requirements

These are future implementation checks, reviewed as design cases here; no application tests were written or run in this session.

| Scenario | Required outcome |
|---|---|
| Two linked handles nominate simultaneously | One reservation; the other receives the existing reservation/capacity state; at most one model dispatch. |
| URL alias, retried webhook or repeated job | Same artifact/attempt; no new slot, call or contribution credit. |
| Evidence absent after three retrieval rounds | Pending with reason, no completed-slot consumption; manual retries do not reset the bound. |
| Provider times out after possible execution | Pending reconciliation; no automatic paid retry or replacement candidate. |
| Valid evaluation rejects effort or credits quality zero | Consumed slot; 1× eligible ordinary quality or zero as dictated by gates. |
| Ordinary 85 is upgraded to eligible effort before close | One selected result of 255, not 85+255; one consumed slot. |
| Upgrade stays pending at close | Keep previously completed 85 at 1×; no later multiplier in that epoch. |
| New submission exactly at close; old worker finishes exactly at close | New submission belongs to next epoch; old result is late and excluded from the old allocation. |
| Close worker is delayed; admin changes result in the delay | Post-cutoff explanation only, even though root is unpublished. |
| Two concurrent corrections from one predecessor | One successor wins; stale correction requires explicit re-review. |
| Missing-evidence artifact is explicitly resubmitted next epoch | Only after earlier work is terminal and never completed; new rules/slot, linked history, no backdated points. |
| E11 activates config A; replacement proposed in E11 or E12 | Earliest activation E13; duration change starts at the shared boundary. |
| Worker crashes between provider response and storage | Reconcile same attempt; no second paid dispatch; no double consumption on completion. |
| Corrections appear after a root exists | Historical decision/hash/root/claim remains byte-identical; later assessment is separate. |
| Audit recomputation | Captured evidence/config/lineage deterministically yield selected contribution totals and manifest hashes, without fetching current URLs or mutable settings. |

Self-review resolved the inherited six epoch invariants plus substantial-work evidence and ordinary-to-effort nomination. The proposal intentionally exposes conservative tradeoffs: one uncertain model call can occupy that epoch's opportunity; no catch-up points for late work; later re-entry requires proof the old attempt never completed; whole claim points can differ from exact allocation weight. These choices need the full written approval requested below.

## Receipt and private-plan amendments for organic-sync

- Stage: local documentation on `h-design-2026-09-19`, based on reviewed `727818b960f6db58de82b4f54268b0c8724d0c96`; no reward implementation or live-service claim.
- Runner: GPT-6 Astra, xhigh, as authorized for this task. No sub-agents or model change. Paid evaluation calls: 0; session billing unavailable.
- Approval status: D1–D3 approved and preserved; O1–O7 **proposed, awaiting written approval**. Do not mark full H-DESIGN/architecture approved from receipt delivery.
- Private delta: `docs/plans/h-design-private-amendments-2026-09-20.md` (ignored), supplementing the unchanged September 19 private note. Organic-sync owns applying it to the private plan, board and contract, retaining concurrent edits.
- H-FIXTURES still owns metadata cleanup and range conversion. Entire synthetic review JSON SHA-256 remains `1b851fa03059c00838438a7bc8d677299da4e87f01e6010e483ce62e75afd936`; 16 reviewed labels unchanged.
- No sibling writes, private strategy in public notes, public build-log edit, push, PR, deployment, new credentials or scheduled jobs. A local documentation checkpoint is permitted; see canonical handoff for verification/delivery state.

## Approval requested / what to do next

Review O1–O7 as the complete operational extension to the approved baseline. Approve the written design or identify revisions, particularly the proposed retry/spend bounds, strict treatment of late work/re-entry, E11→E13 cooldown, and separate exact/whole points. Approval would allow a later implementation-planning task; this session remains limited to design/handoff notes. Existing fee/funding, contract, campaign, SDK and paid-evaluation gates remain separate.

## Suggested skills

`handoff-memory`, `orca-cli`, `handoff`. Use implementation/planning guidance only after full written approval and a separately scoped task. H-FIXTURES remains independent.

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Written operational design / dated checkpoint | `docs/handoffs/2026-09-20-h-design-operational-definitions.md` | This public-safe proposal; awaiting approval |
| Private amendment delta | `docs/plans/h-design-private-amendments-2026-09-20.md` | Ignored; return to organic-sync owner |
| Current engineering handoff | `docs/HANDOFF.md` | References authority and proposal separately |

## Next-session prompt

```text
Resume Hyphae on h-design-2026-09-19. D1-D3 are approved; O1-O7 are a complete operational proposal awaiting full written approval. Preserve all 16 founder labels and the separate dirty main checkout.

Files: docs/HANDOFF.md, docs/handoffs/2026-09-19-h-design-open-decisions.md, docs/handoffs/2026-09-20-h-design-operational-definitions.md, docs/rubrics/eval/mycel-synthetic-review.json, CLAUDE.md
Model: GPT-6 Astra (xhigh) — user-authorized reward/epoch design runner.
Skills: handoff-memory, orca-cli, handoff.

Read the proposal and any subsequent founder response. Record full approval only if explicit; otherwise revise the requested definitions without reopening D1-D3. Return any delta to organic-sync for private canonical amendments. Stay within local design/handoff notes until separately authorized; no reward code, fixture conversion or paid evaluation.
```
