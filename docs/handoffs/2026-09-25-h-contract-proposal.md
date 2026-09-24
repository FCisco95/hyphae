---
date: 2026-09-25
summary: H-CONTRACT proposal. Part A (for Cisco's ruling on Fri Sep 25, due Sep 27) is a yes/no list for the public read API v1: five GET routes, snake_case JSON with exact integers as strings, contribution audit rows with raw/credited quality and exact points, revision status selected/superseded/late, whole points per member only, verified wallets only, honest unavailable states, path versioning, and corrections staying an operator script with a public admin actor. Part B (due Sep 30): RFC 8785 canonical JSON, tag-prefixed SHA-256 hashes for config, evidence, decisions, member-epoch manifests and the epoch audit manifest, the existing 89-byte claim leaf kept byte for byte with the member-epoch manifest hash as its evidence hash, and a shared TS/Rust vector file. Nothing here is built or ruled.
---

# H-CONTRACT proposal

## Status and authority

- **Proposal only.** Nothing in this file is ruled or built. Ruling 1 of `2026-09-24-founder-rulings.md` says Part A is ruled by Sep 27 and the audit-page build starts on that ruling. Part B and the payment definitions (`2026-09-25-payment-definitions-proposal.md`) are due by Sep 30.
- Inputs: the approved O6 and O7 (`2026-09-20-h-design-operational-definitions.md`); R4's effective read (`apps/api/src/rewards/effective.ts`); R5's snapshot and review finding C3 (`2026-09-24-r5-implemented.md`); verified linking and `walletAt` (`2026-09-24-verified-link-implemented.md`); the existing leaf (`packages/core/src/merkle.ts`); the Anchor program, which is still the `initialize` stub. Organic's side: the adapter already built against Hyphae (`GET /v1/communities/:mint`, `…/epochs/:index`, `/v1/wallets/:wallet`, `/v1/contributions/:id`, snake_case) and the leaderboard shape Cisco confirmed for Organic on 2026-09-22: `/v1/communities/{mint}/leaderboard?epoch={n}`, plus `totalEntries` (contributor count that survives pagination) and `closed`.
- Runner: Claude Code, Opus 5.5 (`claude-opus-5-5`), effort xhigh, Windows.

---

# Part A: public read API v1 (for the Fri Sep 25 ruling)

## What you are saying yes to

Each line is one yes or no. The details for each are in the sections below.

| # | Proposal | Recommendation and why |
|---|---|---|
| A1 | **Five public GET routes, and no others, in v1:** community, epoch, epoch contributions, leaderboard, contribution. | **Yes.** That is everything the audit page needs, and the leaderboard is the route Organic's steward selection is waiting for. |
| A2 | **The leaderboard uses the shape you confirmed for Organic:** `GET /v1/communities/:mint/leaderboard?epoch=:index`, with `total_entries` = ranked members and `closed`. | **Yes.** It is already ruled on the consumer side, and one route means one ranking. |
| A3 | **Wire conventions:** snake_case JSON; exact integers (point units, whole points, lamports) as decimal strings; small bounded integers as JSON numbers; exact points as a decimal string; timestamps in RFC 3339 UTC with microseconds. | **Yes.** Organic's adapter already reads snake_case. Big integers lose precision as JSON numbers above 2^53. Microseconds are what Postgres decided on, so a reader can check `accepted_at < closes_at` exactly. |
| A4 | **Versioning in the path (`/v1`).** Only additive fields inside v1. A removed or renamed field, a changed meaning or a new value in a closed enum means `/v2`, with `/v1` kept until its consumers have moved. | **Yes.** It is the simplest rule a consumer can rely on, and Part B's hash fields arrive as additive v1 fields. |
| A5 | **Privacy boundary.** Never served: Telegram ids, usernames, chat or message ids, link sessions, proof requests, idempotency keys, unfinished dispatches, legacy `scoring_runs`. A wallet is served only when its link, valid at the relevant time, is `signature`; otherwise `wallet: null, wallet_status: "unverified"`. Members appear as their Hyphae member id. | **Yes.** It enforces the stop rule of this arc (no Telegram ids, no unverified wallets, no unpublished decisions) in the route contract, not in each page. |
| A6 | **Submitted work is public.** An X submission shows its URL and captured text; a `/submit <text>` submission shows the text. `docs/TESTING.md` says so before any tester is invited. | **Yes.** An audit that can't show the work can't be checked. Members submit work in order to have it judged in public. |
| A7 | **"Published decision" means a committed `reward_decisions` row.** No model output is served before its decision commits. Corrections are served once committed, with actor, reason and evidence. | **Yes.** A committed decision is already posted in the group by the bot. Raw output that never became a decision is not a decision. |
| A8 | **Hashes, not raw payloads, for model runs in v1.** Each revision shows model id, prompt version and hash, input and output hashes, latency and cost; not the raw model input or output. | **Yes.** The hashes pin what was sent and received. Raw payloads add exposure for little audit value in v1, and the whitepaper's "anyone can re-check" line is adjusted to "recorded; hashes public" (edit in the build step). |
| A9 | **Whole points only per member.** A contribution row shows raw quality, credited quality, the gate that changed it, timing, multiplier and **exact** points. Whole points appear in member totals only. | **Yes.** O5 rounds once per member after aggregation; a per-contribution whole number would be a second, wrong rounding. |
| A10 | **States.** Contribution: `counted`, `pending`, `pending_at_close`, `pending_reconciliation`, `excluded`. Revision: `selected`, `superseded`, `late`. Epoch: `open`, `closing` (past `closes_at`, snapshot not yet written), `closed`. | **Yes.** They are exactly R4's selection and R5's snapshot reasons, named for readers. |
| A11 | **Honest unavailable.** Unknown mint, epoch, contribution or a legacy epoch → 404. Bad parameters → 400. Database failure → 503. Sections that do not exist yet (allocation, payment, root, claim) are `{ "status": "unavailable", "reason": … }` and are never zero. No 200 response ever carries a zero in place of a failure. | **Yes.** It is the contract Organic's adapter is built on ("unavailable is not zero"), and it keeps the page from ever showing allocation as paid. |
| A12 | **Public reads never take the community lock.** Open epochs are computed without the lock and marked provisional; final numbers come only from the frozen snapshot. | **Yes.** Otherwise an unauthenticated reader could queue up reward writes behind its lock requests. |
| A13 | **No correction route in v1.** Corrections stay the operator script, authorized by holding the production database credential (Cisco only). | **Yes.** No admin auth exists. A web write path for one operator adds attack surface with no user behind it. |
| A14 | **Public admin actor `admin:<handle>`, authority `community_admin`.** The script takes a required `--actor admin:<handle>` instead of the fixed `script:reward-correct`. The authority is derived from the prefix, so no migration is needed. Reason and evidence references are public, word for word. | **Yes, with handle `admin:cisco`.** O6 wants a stable public audit identity; a Telegram id must never be one. |
| A15 | **Deferred from v1:** `/v1/wallets/:wallet` (HY-3; would come back community-scoped as `/v1/communities/:mint/wallets/:wallet`, verified wallets only), open raids (HY-1's `open_raids`), per-raid usage (HY-5), rules test and strikes (not built). | **Yes.** None of them is on the audit page, and each needs its own scope decision first. |

A "no" on any line sends that line back for revision; the rest can still be ruled.

## A1–A2 — routes

All routes are `GET`, public, unauthenticated, JSON, mounted at `/v1` on the api (`https://hyphae-api.fly.dev`).

| Route | Returns | Source |
|---|---|---|
| `/v1/communities/:mint` | Community, current epoch index, epoch list | `communities`, pinned `epochs` |
| `/v1/communities/:mint/epochs/:index` | Epoch window, status, pinned config, counts, snapshot status, unavailable settlement sections | `epochs`, `reward_configs`, R4 read or R5 snapshot |
| `/v1/communities/:mint/epochs/:index/contributions?offset=&limit=&member=` | Audit rows of one epoch, in intake order | `reward_intakes`, `contributions`, `reward_decisions`, snapshot |
| `/v1/communities/:mint/leaderboard?epoch=&offset=&limit=` | Ranked member totals | R4 totals or `reward_snapshot_members` |
| `/v1/contributions/:id` | One contribution with its full revision lineage | as above, plus `reward_dispatches` provenance |

- `epoch` is required on the leaderboard; missing or malformed → 400. The community response gives the current index.
- `offset` ≥ 0, default 0; `limit` 1–100, default 50. Offset paging is enough: a closed epoch is frozen, and an open one changes between pages whatever the paging scheme. `total_entries` / `total_contributions` let a reader compute the page count.
- `member` (optional, contributions route) filters to one member id.
- Only **pinned** reward epochs are served. A legacy epoch, or a contribution without a reward intake, is 404.

## A3 — wire conventions

- JSON with snake_case keys. The one exception is `config.payload`, served exactly as stored (camelCase), because Part B hashes those bytes.
- Integers that can exceed 2^53, or that are money or points: decimal strings, no leading zeros (`point_units`, `whole_points`, anything in lamports).
- Bounded integers as JSON numbers: quality (0–100), basis points, revision, index, counts, offsets.
- `points`: exact decimal string of `point_units / 10^8`, trailing zeros trimmed (`"127.5"`, `"0.024"`, `"0"`). Same rule as `/me`'s `formatPointUnits`, which moves to `packages/core` so the bot and the API share it.
- Timestamps: RFC 3339 UTC, exactly six fractional digits, `Z` (`2026-09-25T10:04:05.123456Z`). The read service selects them from Postgres as text; they never pass through a JS `Date`, which would truncate to milliseconds.
- Ids: lowercase UUID strings. Enums: lowercase snake_case strings.
- Headers: `Cache-Control: public, max-age=15` while an epoch is open or closing, `max-age=300` once its snapshot is frozen; `Access-Control-Allow-Origin: *` on `/v1` GETs (public data, useful to third-party auditors).

## A5–A8 — what is and is not served

| Served | Never served |
|---|---|
| Member id (Hyphae UUID) | Telegram user id, username, chat id, message id |
| Wallet, only if the link valid at `as_of` has `method = 'signature'` | Pasted wallets, wallet history, proof requests, link sessions, nonces |
| Contribution kind, URL, captured text, capture source, time and limitations | oEmbed HTML, idempotency keys, artifact keys |
| Committed decisions and corrections (all revisions) | Dispatches without a committed decision, their errors and raw output |
| Model id, prompt version and hash, input and output hashes, latency, cost | Raw model input and output (v1) |
| Pinned config payload | Pending config proposals |
| Nomination kind and state | Nomination pending reasons (model-reported evidence gaps) |

`as_of` for a wallet: the epoch's `closes_at` once the epoch is closed (the wallet a payout would use, D3), otherwise the read time. `wallet_status` is `verified`, `unverified` or `none` (no link at that time).

## A9–A10 — shapes

### Community

```json
{
  "mint": "…",
  "name": "Hyphae Lab",
  "reward_intake": "open",
  "current_epoch": 1,
  "epochs": [
    { "index": 1, "opens_at": "2026-09-25T00:00:00.000000Z", "closes_at": "2026-10-02T00:00:00.000000Z", "status": "open" }
  ],
  "as_of": "…"
}
```

`current_epoch` is the index of the pinned epoch whose `[opens_at, closes_at)` contains the database time, or `null`. It stays a number because Organic's adapter already parses it that way. `epochs` is newest first; it is unpaginated in v1, because weekly epochs stay small. `reward_intake` is `paused` when `reward_intake_paused_at` is set.

### Epoch

```json
{
  "community": { "mint": "…", "name": "Hyphae Lab" },
  "index": 1,
  "opens_at": "…", "closes_at": "…",
  "status": "open",
  "closed": false,
  "final": false,
  "as_of": "…",
  "config": {
    "id": "…",
    "rubric_version": "1.2.0",
    "prompt_version": "reward-eval/1",
    "effort_multiplier_bps": 30000,
    "slot_limit": 1,
    "payload": { "version": 2, "rubric": { … }, … }
  },
  "counts": {
    "contributions": 7, "members": 3,
    "counted": 5, "pending": 2,
    "pending_at_close": 0, "pending_reconciliation": 0, "excluded": 0
  },
  "totals": { "point_units": "…", "points": "…" },
  "snapshot": { "status": "not_frozen" },
  "allocation": { "status": "unavailable", "reason": "no_settlement" },
  "payment": { "status": "unavailable", "reason": "no_settlement" }
}
```

- `closed` is R4's flag: `closes_at` has passed by the database clock. `final` is true only once the snapshot exists. `status` is `open` (not closed), `closing` (closed, not final: the close job runs within ~5 minutes) or `closed` (final).
- `snapshot` is `{ "status": "frozen", "closed_at": …, "cutoff_assumption": … }` once written.
- `allocation` and `payment` stay `unavailable` until R6 and the payment definitions define them. The `reason` values are an open enum. This is the one place a new value is additive: readers must treat any `status: "unavailable"` as unavailable, whatever the reason.

### Contribution row (contributions route, and the head of the contribution route)

```json
{
  "id": "…",
  "epoch": { "index": 1, "closes_at": "…", "closed": false, "final": false },
  "member_id": "…",
  "wallet": "MAoR…VhAB", "wallet_status": "verified",
  "kind": "reply",
  "url": "https://x.com/…/status/…",
  "raid_id": "…",
  "accepted_at": "…",
  "state": "counted",
  "selected": {
    "revision": 2,
    "raw_quality": 84, "credited_quality": 0, "credit_rule": "hard_zero",
    "flags": ["off_topic"],
    "effort": "not_nominated",
    "timing_bps": 10000, "multiplier_bps": 10000,
    "point_units": "0", "points": "0",
    "explanation": "…",
    "corrected": false
  }
}
```

- `state`: `counted` (a selected revision exists; its points may be 0), `pending` (no decision yet, epoch not final), and once final the snapshot's own reason: `pending_at_close`, `pending_reconciliation` or `excluded` (only late decisions exist). While an epoch is `closing`, R4's `late` shows as `excluded`, which is what the close will write.
- `selected` is `null` unless `state` is `counted`.
- `credit_rule` is the "why" behind raw 84, credited 0: `none`, `hard_zero` (a `guideline_breach`, `spam` or `off_topic` flag), `ai_cap_mild` (capped at 79), `ai_cap_strong` (capped at 40, which then falls under the floor) or `below_floor` (under 60). A pure function in `packages/core`, tested against R1's `creditedQuality` on every combination.
- There is no `whole_points` on a row (A9). The leaderboard carries the member's whole points.

### Contribution (`/v1/contributions/:id`)

The row above, plus:

```json
{
  "text": "…",
  "capture": { "source": "x_oembed", "captured_at": "…", "limitations": ["media_not_captured"] },
  "reentry_of": null, "reentered_as": null,
  "nomination": { "kind": "upgrade", "state": "completed_eligible" },
  "revisions": [
    {
      "revision": 1, "status": "superseded",
      "accepted_at": "…", "affects_allocation": true,
      "source": "model",
      "raw_quality": 85, "credited_quality": 85, "credit_rule": "none",
      "flags": [], "effort": "not_nominated", "effort_criteria": null,
      "timing_bps": 10000, "multiplier_bps": 10000,
      "point_units": "8500000000", "points": "85",
      "explanation": "…",
      "model": {
        "model": "…", "prompt_version": "reward-eval/1", "prompt_hash": "…",
        "input_hash": "…", "output_hash": "…", "latency_ms": 5210, "cost_micro_usd": 14000
      },
      "correction": null
    }
  ]
}
```

- Revision `status`: `selected` (the last revision accepted strictly before `closes_at`; provisional while the epoch is open), `superseded` (an earlier revision accepted before `closes_at`), `late` (accepted at or after `closes_at`; `affects_allocation` false; explanatory only, O6).
- `effort_criteria` mirrors the stored criteria: `{ original_substance: { met, note }, inspectable_work: …, community_contribution: … }`, or `null`.
- `correction`: `{ actor, authority, reason, evidence_refs }` on correction revisions, where `model` is `null`.
- A closed epoch's `selected` revision is the snapshot's decision. The service asserts they match and answers 503 if they don't: a mismatch would be a bug, never something to paper over.

### Leaderboard

```json
{
  "community": { "mint": "…" },
  "epoch": { "index": 1, "opens_at": "…", "closes_at": "…" },
  "closed": false,
  "final": false,
  "as_of": "…",
  "total_entries": 3,
  "total_contributions": 7,
  "offset": 0, "limit": 50,
  "entries": [
    {
      "rank": 1, "member_id": "…",
      "wallet": "MAoR…VhAB", "wallet_status": "verified",
      "point_units": "25500000000", "points": "255", "whole_points": "255",
      "contributions": 3, "counted": 2, "pending": 1
    }
  ]
}
```

- One entry per member with at least one admitted contribution, including zero-point members.
- Order: `point_units` descending, then `member_id` ascending. `rank` = 1 + the number of members with strictly more point units, so ties share a rank.
- Final epochs read `reward_snapshot_members`; the rest read R4's totals.
- `total_entries` is Organic's meaning (ranked members). R4's internal `totalEntries` counts contributions, and appears here as `total_contributions`.
- Differences from Organic's draft entry: no `last_score` (O7: weighted points must not stand in for a score; per-contribution quality is on the contribution route) and no `rules_test_passed` (not built; absent means unavailable, not false).

## A12 — reads and the lock

`effectiveResults` takes `FOR SHARE` on the community row, so a read waits for an in-flight reward writer and blocks the next one. That is right for close and for `/me`, but not for an unauthenticated public route. The read service runs `selectEffective` in a read-only transaction without the lock. Open-epoch numbers are provisional by definition (`final: false`), and final numbers come from the snapshot, which close wrote under the lock.

## A13–A14 — admin actor and corrections

| Item | Proposal |
|---|---|
| Write path | The operator script `apps/api/scripts/reward-correct.ts` only. No HTTP route, bot command or page writes corrections in v1. |
| Authentication | Holding the production `DATABASE_URL`, which only Cisco has. It is stated as operational, not cryptographic: the audit record says who, not a signature proving who. |
| Actor | Required `--actor admin:<handle>`, matched against `^admin:[a-z0-9_-]{1,32}$`. Recommended handle: `admin:cisco`. Stored in the existing `correction_actor`. |
| Authority | `community_admin` for the `admin:` prefix. The only authority in v1, derived at read time, so no migration. Any existing `script:reward-correct` row reads as authority `operator_script`. Production has none today: no decision exists yet. |
| Public text | Reason and evidence references are published verbatim. The script's help says so, and says never to paste links that carry private ids. |
| Later | An admin route would reuse the wallet-signature machinery (admin wallet signs the correction), after the hackathon and under its own scope. |

The script change is one flag and one regex. It lands in the build step after this ruling, test-first.

## Downstream: Organic (DEP-01)

- The leaderboard route matches the shape Cisco confirmed for Organic. Organic maps `total_entries`, `closed` and `whole_points`/`points`, and has to drop `lastScore` and `rulesTestPassed` from its entry type.
- Organic's community schema defaults `open_raids` to `[]` when absent. Against v1 that shows "no open raids" instead of unavailable, so Organic should treat an absent field as unavailable. The same applies to `rules_test_passed` (`default(false)`) and `strikes` (`default(0)`).
- Organic's epoch schema requires `pot_lamports`. v1 serves no pot, so Organic's parse fails and shows unavailable. That is the honest outcome; Organic moves to `allocation.status` when it next touches the adapter.
- `/v1/wallets/:wallet` stays 404 in v1, and Organic shows `not_found`. Organic should read it as "not served", not "no such wallet".
- `/v1/contributions/:id` becomes a real JSON route. Organic's "reasoning ↗" link points at it; the human page is `apps/web`'s contribution page, and Organic can switch the link once it is deployed.

---

# Part B: commitments and claim bytes (due Sep 30)

Part B decides bytes. Nothing reads or writes these hashes until R6. R6 must add the decision hash before any root (R5 finding C3).

## B at a glance

| # | Proposal | Recommendation and why |
|---|---|---|
| B1 | **Canonical JSON = RFC 8785 (JCS).** Decision, evidence and manifest payloads use a restricted profile, `hyphae-c14n/1`: ASCII `[a-z0-9_]` keys, no JSON numbers (integers as canonical decimal strings), strings kept exactly as captured with lone surrogates rejected, explicit `null`, arrays in a specified order. | **Yes.** A named standard gives a Rust or Python implementation something to test against. For JSON-safe values, the repo's `canonicalJson` already produces JCS (ECMAScript string escaping, keys sorted by UTF-16 code unit); Part B adds a guard that rejects anything outside the profile. |
| B2 | **Hash = `sha256(utf8(tag) ‖ 0x00 ‖ c14n bytes)`**, lowercase hex. Tags: `hyphae/config/v1`, `hyphae/evidence/v1`, `hyphae/decision/v1`, `hyphae/member-epoch/v1`, `hyphae/epoch-audit/v1`. | **Yes.** Domain separation by tag. The version lives in the tag, and a tagged preimage starts with `h` (0x68), so it can never equal a merkle leaf (0x00) or node (0x01) preimage. |
| B3 | **Config hash** = `hyphae/config/v1` over the stored `reward_configs.payload`, under full JCS (the rubric carries decimal weights such as 0.35, and JCS defines their formatting). Stored in a new `reward_configs.config_hash`. The internal `digest` keeps its meaning. | **Yes.** O4/O7 hash the full payload. A new column avoids silently redefining `digest` or the unused `epochs.rubric_hash`. |
| B4 | **Evidence hash** = `hyphae/evidence/v1` over `{ community_id, contribution_id, member_id, kind, url, text, capture: { source, captured_at, limitations }, raid_id, intake_accepted_at, reentry_of }`. | **Yes.** It is what was judged, from immutable rows. oEmbed HTML is left out: it is not what the model judged, and it carries numbers. |
| B5 | **Decision hash** = `hyphae/decision/v1` over every field of the revision, including `predecessor_hash`, `config_hash`, `evidence_hash`, model provenance hashes, or the correction's actor, authority, reason and evidence. Stored on `reward_decisions.decision_hash`. The snapshot entry copies the selected one. | **Yes.** O7's decision hash, with the predecessor binding the whole lineage. Stored per revision so late and superseded revisions are committed too. |
| B6 | **Backfill.** R6's migration adds the hash columns as nullable. A deterministic backfill fills them from the insert-only rows. Publication refuses any snapshot with a null hash. | **Yes.** Decisions exist from Sep 25, before R6. Their inputs never change, so a later hash is the same hash. |
| B7 | **Member-epoch manifest** (`hyphae/member-epoch/v1`): network, program id, community, epoch window, config hash, member, payout wallet (`walletAt(closes_at)`, `signature` only, else `null`), entries sorted by contribution id (decision hash or reason, point units), exact total, whole points, and settlement inputs as defined by the payment ruling. | **Yes.** It is O7's wallet/epoch manifest, and it is what the leaf commits to. |
| B8 | **Keep the existing 89-byte claim leaf byte for byte:** `0x00 ‖ wallet(32) ‖ epoch_index u64le ‖ score u64le ‖ amount u64le ‖ evidence_hash(32)`, with `score` = whole points, `amount` = lamports, `evidence_hash` = the member-epoch manifest hash. Nodes, sorting and odd-node promotion unchanged. | **Yes.** O7 says to keep the leaf unless a versioned contract changes it. The manifest hash already binds network, program, community and every entry. |
| B9 | **Epoch audit manifest** (`hyphae/epoch-audit/v1`): every snapshot entry (including zero, pending and excluded ones) and every member-epoch manifest hash, with the cutoff assumption. **Its hash is stored on-chain in the epoch account next to the root** (32 bytes). | **Yes.** O7 notes that a root alone does not prove the zero and pending entries are complete. Anchoring the audit hash does, for 32 bytes per epoch. |
| B10 | **One shared vector file**, `packages/core/test-vectors/h-contract-v1.json`. TS tests generate and assert it; a Rust test in `programs/hyphae` asserts the leaf, node and proof vectors from the same file; a stdlib-only Python check reproduces the JSON hashes. | **Yes.** On-chain code only needs the binary vectors. The Python check proves the JSON hashes are not "whatever JavaScript does". |

## B1 — the `hyphae-c14n/1` profile

- JSON values: object, array, string, `true`, `false`, `null`. Numbers are refused.
- Keys: `^[a-z0-9_]+$`. Sorting is then the same in every language.
- Integers: decimal strings, `0` or no leading zero, no sign, no exponent. Timestamps: A3's six-digit RFC 3339 UTC form. Hashes: 64 lowercase hex characters. Booleans stay booleans.
- Strings: as captured; no Unicode normalization. Lone surrogates are refused (JCS output would differ between languages).
- Arrays: order specified per field. Flags are sorted ascending. Capture limitations keep their stored order. Entries are sorted by contribution id, members by member id.
- Output: JCS (RFC 8785) serialization as UTF-8 bytes. For this profile it equals `JSON.stringify` with sorted keys, and Python's `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`.

## B5 — decision payload

```json
{
  "community_id": "…", "epoch_id": "…", "contribution_id": "…",
  "revision": "2", "predecessor_hash": "…",
  "config_hash": "…", "evidence_hash": "…",
  "source": "model",
  "model": { "model": "…", "prompt_version": "reward-eval/1", "prompt_hash": "…", "input_hash": "…", "output_hash": "…" },
  "correction": null,
  "nomination_id": "…",
  "raw_quality": "85", "credited_quality": "85", "flags": [],
  "effort": "eligible",
  "effort_criteria": {
    "community_contribution": { "met": true, "note": "…" },
    "inspectable_work": { "met": true, "note": "…" },
    "original_substance": { "met": true, "note": "…" }
  },
  "timing_bps": "10000", "multiplier_bps": "30000", "point_units": "25500000000",
  "explanation": "…",
  "accepted_at": "…", "affects_allocation": true
}
```

- Revision 1 has `"predecessor_hash": null`. A correction has `"source": "correction"`, `"model": null` and `"correction": { "actor", "authority", "reason", "evidence_refs" }`, with `evidence_refs` in stored order.
- Latency and cost are left out: they describe the call, not the decision.

## B7–B9 — manifests, leaf and anchor

- Member-epoch manifest fields: `network` (`solana:devnet` / `solana:mainnet`), `program_id` (base58), `community_id`, `mint`, `epoch` (`id`, `index`, `opens_at`, `closes_at`), `config_hash`, `member_id`, `wallet` (or `null`), `entries` (`contribution_id`, `decision_hash` or `null`, `reason` or `null`, `point_units`), `point_units`, `whole_points`, `settlement` (fields from the payment ruling, for example `amount_lamports`, `fee_lamports`; `null` until defined).
- A member with no verified wallet at `closes_at` still gets a manifest (wallet `null`) in the audit manifest, and no leaf.
- Leaf: `wallet` is the manifest wallet's 32 bytes; `epoch_index` is the Hyphae epoch index as u64; `score` = `whole_points` (R1 already refuses anything above u64); `amount` = lamports. A member can have `score` 0 and `amount` > 0 (O5: allocation weight uses exact units).
- On-chain (Anchor window): the epoch account stores `root: [u8; 32]` and `audit_hash: [u8; 32]`. The claim receipt PDA is seeded `["claim", epoch_account, wallet]`, so a leaf pays once. `leaves_epoch_wallet` already keeps one leaf per wallet per epoch off-chain. On-chain hashing uses the SHA-256 syscall with the same `0x00`/`0x01` prefixes.

## B10 — vector plan

| Vector | Cases |
|---|---|
| c14n + config | The live MYCEL 1.2.0 payload (decimal weights), plus a payload with a non-ASCII string |
| evidence | X post with limitations; `/submit` text with emoji, a combining accent and a control character; a re-entry |
| decision | Model revision 1; effort upgrade revision 2 (predecessor bound); late correction revision 3 (`affects_allocation` false) |
| manifests | A member with counted, pending and excluded entries; a member with no verified wallet; the epoch audit manifest over both |
| leaf + tree | Leaves with score 0 and amount > 0, and with the maximum u64 score; trees of 1, 2, 3 and 5 leaves; each proof; one tampered proof that must fail |

TS writes the file once from fixtures and then asserts against it. Regenerating it is a reviewed change. The Rust test uses `include_str!` on the same file, so the on-chain crate cannot drift from it.

## Compatibility

- `merkle.ts` leaf and node bytes: unchanged.
- `scoring_runs.evidence_hash` (legacy): keeps its meaning and is never reused for `hyphae/evidence/v1`.
- `reward_configs.digest`: stays internal. `epochs.rubric_hash`: stays unused (null everywhere), to be dropped in a later migration rather than redefined.
- `settle.ts` uses floating-point weights, which O5 does not allow. R6 replaces it with exact bigint allocation over point units (MYCEL `stakeWeight = none`). The fee and rounding come from the payment ruling.
- The read API gains `config_hash`, `evidence_hash` and `decision_hash` as additive v1 fields once R6 fills them.

## H-CONTRACT gate rows and their proposed answers

| Gate row (O7, DEP-01, DEP-09) | Answer |
|---|---|
| Public read wire schemas (HY-1, HY-2, HY-4, leaderboard) | A1–A3, A9–A10 |
| Wallet-only URL scope (HY-3) | A15: deferred; community-scoped and verified-only when added |
| Per-raid usage (HY-5), open raids | A15: deferred |
| Versioning and compatibility | A4; Part B fields are additive |
| Honest unavailable, empty and zero states | A11 |
| Private identifiers out of public payloads | A5, A6 |
| What counts as published | A7, A8 |
| Admin actor, authority and auth for corrections | A13, A14 |
| Canonical encoding and domain separation | B1, B2 |
| Configuration hash | B3 |
| Evidence manifest | B4 |
| Decision hash with predecessor binding (R5 C3) | B5, B6 |
| Wallet/epoch manifest | B7 |
| Claim evidence hash and leaf bytes | B8 |
| Epoch audit manifest and completeness | B9 |
| Cross-language hash vectors | B10 |
| Existing leaf and historical hashes | Compatibility |
| Consumer compatibility (Organic) | Downstream: Organic |
