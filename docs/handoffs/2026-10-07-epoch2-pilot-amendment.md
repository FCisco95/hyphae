---
date: 2026-10-07
summary: Design of the epoch 2 pilot amendment (release B) and Cisco's epoch 2 payout ruling. From an announced, future effective time, contributions admitted in epoch 2 score with reward-eval/2. Earlier decisions stay untouched; rubric, flags, hard zeros, AI caps, floor and payout math do not change.
---

# Epoch 2 pilot amendment: rulings and design

Written 2026-10-07 by Claude Opus 5.5 (`claude-opus-5-5`, effort xhigh). Design first, then built test-first.

## Rulings (Cisco, 2026-10-07)

1. **The amendment.** His words: "This epoch needs to make it easier. It's super hard for people to score and I need valid scores for the hackathon live testing. I want to do it now." Done as a public pilot amendment: announced before it takes effect, never retroactive, recorded everywhere, never a silent edit. Public reason: "We are in the pilot testing phase; I'm making scoring less strict so people get valid scores while they are still learning the algorithm and what is expected."
2. **Epoch 2 payment (asked ~14:45Z).** Testers who meet every existing condition before the close are paid at the Oct 8 to 9 sitting from the approved 0.5 SOL gross pot. His words: "Yes, I approve and I want to pay qualifiers." The conditions do not change: a signed wallet, a 6/6 rules pass before the close, 100,000 MYCEL held at the hold check, and Cisco's attestation at C18b that each X author is the member's own account (unconfirmed authors are zeroed under the existing ruling). Each payable member gets at most 25 % of the net pot (15 % once 20 or more are payable, per `allocate`), so the most Cisco spends is still the approved pot.
   - Why not "payment from epoch 3": nothing in the code can stop a member who meets every condition from being payable. Keeping testers unpaid would need a new payout-gate exclusion (a payout rule change mid-epoch) or zeroing valid scores. Both break what the announcement promises.
   - Not a ruling yet: Cisco said he is "willing to even put more rewards like one more Solana if we start to have more engagements". The pot stays 0.5 SOL gross until he names an amount and an epoch; the announcement does not promise it.

## What the amendment is

A one-time, append-only record for one open epoch:

| Field | Meaning |
|---|---|
| `epoch_id` | The open epoch it changes. At most one amendment per epoch (unique). |
| `from_config_id`, `to_config_id` | The epoch's pinned config, and the config new contributions pin instead. |
| `from_prompt_version`, `from_prompt_template_hash`, `to_prompt_version`, `to_prompt_template_hash` | The scoring prompt before and after, with the template hashes the configs pin. |
| `effective_at` | When it starts. Must be in the future when recorded and before the epoch closes. |
| `actor`, `reason` | Who recorded it and the public reason. Never blank. |
| `recorded_at` | Database time under the community lock. A check keeps `effective_at > recorded_at`. |

The `to` config is the `from` config with only `scoring` replaced by the new prompt's registered pin. Recording refuses any other difference, so the rubric, timing, flags, hard zeros, AI caps, the 60 floor, effort policy and points cannot change through an amendment.

## How scoring follows it

Admission already pins a config per contribution (`reward_intakes.config_id`), and evaluation, corrections, decisions and the audit commitments all read that pin. So the change is one place: at admission (and re-entry), under the community lock, a contribution admitted at or after `effective_at` pins `to_config_id`; earlier ones pin the epoch's config as before.

- **Not retroactive by construction.** Recording takes the same lock and requires `effective_at > now`, so no contribution admitted before the record can match it, and no existing intake, dispatch or decision is touched. Contributions admitted before `effective_at` but scored later keep `reward-eval/1`.
- **The epoch row does not change.** `epochs.reward_config_id` stays the base config. Proposals, the O4 cooldown and epoch 3's activation of the pending `reward-eval/2` proposal are unaffected; an amendment does not carry into the next epoch.
- **Mixed epoch downstream.** Close and snapshot use decisions' points only. The payout gate reads the epoch's rubric (unchanged). `epochCommitments` already hashes each decision with its own `config_hash` and each model decision with its `prompt_version`, and the commitment store already stores one hash per config. Tests cover a mixed epoch through close, commitments and publication.

## Where it is visible

- **Epoch API** (`GET /v1/communities/:mint/epochs/:index`): an additive v1 field `amendments` (A4 pattern: required in this api's strict schema, optional for consumers), each with effective and recorded times, actor, reason, and from/to config id, prompt version and template hash.
- **Contribution API**: an additive field `amendment` (`null`, or the effective time and prompt version) when the contribution was admitted under it. Each revision already shows its `prompt_version`.
- **Web**: the epoch page shows the amendment and what did not change; the contribution page says it was scored under the amendment.
- **Audit manifest at close (H-CONTRACT B9):** `EpochAuditManifest` gains an optional `amendments` list, present only when the epoch has one, so every earlier manifest and the published v1 vectors keep their bytes and hashes. Each entry commits the times, actor, reason, and from/to config hash and prompt version/hash. The on-chain `audit_hash` therefore commits the amendment.
- **Records:** `docs/rubrics/CHANGELOG.md`, the security page claim, BUILDLOG, HANDOFF.

## How it is recorded

`apps/api/scripts/amend-epoch.ts <mint> --epoch <n> --prompt <version> --effective-at <iso with Z> --actor <name> --reason <text> [--plan]`. `--plan` runs every check and prints the record inside a transaction that is rolled back. Run from the exact-source worktree after release B is live, with the effective time from Cisco's published announcement.

## Release B order (plan to follow in its own file)

Migration 0016 (one new table, additive) → API → worker → Cisco publishes the announcement with the effective time → record the amendment before that time → a test contribution after it scores with `reward-eval/2` and shows as amended. The old image runs on the new schema; rolling back the API after the amendment is recorded would pin new contributions to `reward-eval/1` against the announcement, so after recording, fix forward.

## Not changed

Rubric 1.2.0, flags, hard zeros, AI caps, the 60 floor, timing, effort policy, points, the payout gate, allocation and its caps, publication math, the program, the pending epoch 3 proposal, earlier epoch 2 decisions, and the held refs.
