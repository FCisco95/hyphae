# Participation minimum proposal

Date: 2026-10-09. Operator: Codex (GPT-6); exact runtime model ID/effort not exposed.

User intent: “for the people that have zero points” give a small minimum, then distribute the remainder according to points so people can understand the payment mechanism. This steers the conversation after Cisco's stop-for-sleep request, but does not establish Ledger attendance, transfer authority, a numeric floor, eligibility definition or a released reward policy.

Current source packages/core/src/allocation.ts explicitly refuses payable members with non-positive point units. The operator packet also requires signed wallets/rules/holder/author/safety evidence. Existing fee and per-wallet caps remain part of the payout contract; “distribute the rest” cannot silently remove them or assign fake points. C18b still has no human attestation or clean final audit; no new proposal waives that evidence.

Treat implementation as architectural policy work: eligibility, allocation, commitments and public explanation are coupled. No implementation/spec approval inferred from this initial proposal. Recommendation only: equal small baseline for legitimate eligible participants (including actual zero-point own work), plus points-based bonus. A zero-only floor can pay more than a low-positive contributor; avoid that incentive. Failed ownership/safety/duplicate checks and missing wallet proof are not equivalent to low scoring, and remain excluded. Do not silently retrofit epoch2; separately labelled pilot support or a prospectively announced future-epoch policy are alternatives requiring explicit scope/budget and review. No choice selected.

Founder clarification: “Submitted work and got only zeros.” The requested population is submitters whose scores were all zero, not everyone who joined. This identifies the intended group; it does not attest authorship, safety, uniqueness or wallet eligibility. Check why each submission scored zero before proposing a payable roster. The shared-baseline recommendation above remains unapproved; this answer does not extend the minimum to positive-point participants.

Next define exact floor or baseline pool, eligible roster, budget/fee/cap treatment, effective epoch and public notice. Do not invent these from the approved0.5SOL pot. Required other-family sensitive review and release conditions remain before any new policy deployment. No source change, scoring call, production write, pause, funding, signing, publish, claim, message or post this turn. Sleep stop and funding/publication holds remain in force.

## Generated artifacts this session

| What | Home | Stage |
|---|---|---|
| Policy intent and answered population question | This checkpoint, docs/HANDOFF.md, docs/BUILDLOG.md | Proposal only; all-zero submitters specified, actual eligibility/amount/effective epoch open; local/public-safe |
| Code/config/funds/keys/live schedule | None changed | Existing payout/release holds preserved |

## Suggested skills

handoff-memory, the-analyst, superpowers:brainstorming for architectural reward-policy design, superpowers:verification-before-completion, handoff. Only after complete founder rulings/design follow writing-plans and the required independent sensitive review; no emergency implementation around the close.

## Next-session prompt

```text
Cisco proposed a small amount for zero-point people plus point-weighted distribution of the remainder, to explain rewards. He clarified the group: people who submitted work and received only zero scores. No floor amount, verified roster, budget/cap/fee treatment or effective epoch defined. Current allocation rejects payable<=0points; do not manufacture points/override eligibility or silently change epoch2. Recommendation only: common baseline for legitimate eligible participants plus bonus, avoiding zero-only inversion; founder has not approved extending the minimum to positive-point participants. Missing pre-close author audit remains a blocker. Sleep/funding/payout/publication/reviewed-feature/next holds unchanged; no attendance/signing/transfer.
Files: CLAUDE.md, docs/HANDOFF.md, packages/core/src/allocation.ts, docs/demo/2026-10-08-first-payout-readiness.md, docs/handoffs/2026-10-09-participation-minimum-proposal.md, docs/handoffs/2026-10-09-tomorrow-session-boundary.md
Model: project recommendation Opus5/xhigh for policy architecture; record actual runtime identity/effort, not an invented model ID.
Skills: handoff-memory, the-analyst, superpowers:brainstorming, superpowers:verification-before-completion, handoff.
Do not re-ask submitted work versus everyone who joined: answered. On return, inspect why all-zero submissions scored zero and count the legitimate eligible group before proposing amounts. Define amount/budget/effective epoch one decision at a time without assuming transfers or retroactive policy authority. Preserve legitimate author/wallet/rules/holder/safety gates, existing points/frozen manifests/caps and both histories/held next0018+0019/verify0.1.0/publication freeze. No implementation before reviewed policy/design; no Treasury-source inference, new keys/messages/posts/deploys or Organic/vault edits.
```
