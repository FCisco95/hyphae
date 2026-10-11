---
date: 2026-10-08
summary: Honest payout status for members. The read API serves each member's payout-gate status, the site says "Scored" plus what pay still needs instead of "Counted.", /me shows a checklist with the next step, and a member's first score message of an epoch names a missing wallet or rules test once. Local branch only; nothing pushed or deployed.
---

# Payout status for members (worker note, 2026-10-08)

Branch `FCisco95/payout-status`, commits `d008411`, `21fcb85`, `dcf46ab`, `8f82146` and this note. Not pushed, not merged, not deployed (hold until 2026-10-10T00:00Z).

## The problem

Since the "earn first" ruling of 2026-10-07, members are scored before they sign a wallet or pass the rules test. The epoch page labelled every scored row "Counted.", so a member without a wallet could read it as "I will be paid".

## What works now

- **One derivation, the gate's own.** The payout gate's epoch terms and member stage are extracted unchanged from `apps/api/src/payout/gate.ts` as `payTerms` and `judgeMembers`. The gate calls them exactly as before (its 79 tests across gate, hold-gate, publication and publish pass unmodified). `apps/api/src/payout/readiness.ts` runs the same two functions for the read API, /me and the score message. No second implementation of any payout rule exists.
- **Read API (additive, v1).** Each contribution row, leaderboard entry and single contribution has `payout`:
  - `{ status: "payable" | "held" | "not_payable", reasons, hold }`: the gate's verdict as of the read. `reasons` are the gate's own (`no_points`, `no_verified_wallet`, `no_rules_test`, `below_hold`, `hold_pending`). `hold` is `at_close` before the close (never a result), then `pending`, `holder`, `below`, `not_checked` (the member misses another condition, so the gate never reads the balance) or `not_required`.
  - `{ status: "unpaid_epoch" }`: before the community's first paid epoch, or no rules test covers the rubric.
  - `{ status: "published" }`: the settlement is the record.
  - The strict schema enforces the gate's invariants and refuses any hold result, or a payable verdict that would need one, before the close. Consumers parse it as optional (older APIs). OpenAPI is generated from the same schemas and documents it; `docs/community/INTEGRATING.md` has one new row.
- **Web.** A scored row reads "Scored." plus the status (copy below). The leaderboard has a Payout column; the contribution page banner uses the same sentence. Plain text, no alarm styling. A published epoch's rows point to the settlement.
- **Bot /me.** In a paid epoch: wallet, rules test and hold as three checks, the one next step, and a button straight to it (the private wallet link, then the rules test). Before the close the hold reads "read once after the close", never met. The amount comes from the read RPC like /setup. Without a reward epoch, /me is unchanged.
- **Score message.** When a decision's message is sent while its epoch is open and pays, and it is the member's first sent score message of that epoch, a missing wallet or rules test adds one line and one button. Once per member per epoch comes from `reward_decisions.notified_at` (no migration). If the status cannot be read, it is logged and left out; the score is still sent.

## How it was checked

- Readiness derivation (`readiness.test.ts`, PGlite): every combination of signed wallet × rules test × points before the close and after it, then holder, below, uncertain and a result for another wallet; member by member it equals `evaluatePayoutGate`. Plus unpaid (no first paid epoch, a later one, no rules test), published, and a rubric with no hold.
- Schema (`read-api-schema.test.ts`): required of this API on rows, entries and the contribution, optional for consumers; every verdict before and after the close; refusals for a hold claimed before the close and for status, reasons and hold that disagree.
- Read service (PGlite): rows, leaderboard and contribution agree for each member; open, closing, frozen, hold result, published; the unpaid demo; no row locks on the paid path.
- Web: `format.test.ts` for every sentence; view tests for the rows, the leaderboard column and the banner, and the existing "never reads as paid" rule.
- /me: pure checklist for every state, `mePayout` on PGlite, and the command end to end with its button URLs.
- Score message: the hint line, `scoreHint` on PGlite (first message, a second one before and after the first is sent, another member, a member already set, after the close, a late decision, an unpaid epoch), and `notifyReward` with and without the line and button.
- Gate (Windows, Node 24, while other workers kept the machine at 94 to 100% CPU):
  - `pnpm typecheck` exit 0; `pnpm lint` exit 0 (419 files).
  - `pnpm test`: core 124, read-client 26, web 132 passed; API 1070 passed, 3 skipped (100 files). In the full-parallel runs the API vitest process still exited 1 on a vitest worker RPC timeout ("Timeout calling onTaskUpdate") with no failed test; the same suite with `--maxWorkers=3` exited 0 (1070 passed, 3 skipped). The first run also failed `.env.example` (it read my temporary render file as it was deleted) and an eval-subprocess test under load; both pass alone and in every later run. CI on a quiet runner is not yet run.
  - `pnpm --filter @hyphae/api test:pg` (Postgres 17 in Docker, `HYPHAE_TEST_PG_PORT=55491`): 74 of 74, exit 0.
  - No `packages/db` change, so no `drizzle-kit check` was needed.

## Rendered epoch page rows (fixture data)

Rendered with `renderToStaticMarkup` from `EpochView`/`LeaderboardView` and the web fixtures (`openContributions`, `contributions`, `leaderboard`):

```
Open epoch
Work  | Wallet    | Score                | State
reply | MAoR…VhAB | Raw 85, credited 85. | Scored. Wallet and rules test done. The hold is checked after the close.
reply | no wallet | Raw 85, credited 85. | Scored. Not payable yet: link a wallet by signing.
reply | MAoR…VhAB | Raw 85, credited 85. | Scored. Not payable yet: pass the rules test.
reply | unverified| Raw 85, credited 85. | Scored. Not payable yet: link a wallet by signing and pass the rules test.
reply | MAoR…VhAB | —                    | Not scored yet.

Final epoch (closed, not published)
reply | MAoR…VhAB | Raw 85, credited 85. | Scored. Payable: wallet, rules test and hold confirmed.
text  | unverified| —                    | Not scored before the epoch closed; it earns nothing in this epoch.

Leaderboard (open), Payout column
1 | MAoR…VhAB  | 127.5 | Wallet and rules test done. The hold is checked after the close.
2 | unverified | 0     | Not payable yet: link a wallet by signing, pass the rules test and earn points.
```

```html
<tr><td data-label="Work"><a href="/contribution/00000000-0000-4000-8000-000000000022">reply</a> …</td>
  <td data-label="Member" class="mono">00000000</td>
  <td data-label="Wallet"><span class="muted">no wallet</span></td>
  <td data-label="Score">Raw 85, credited 85.</td>
  <td data-label="Points" class="num">255 (3×)</td>
  <td data-label="State">Scored. Not payable yet: link a wallet by signing.</td></tr>
```

## Every new member-visible string (for Cisco's approval)

Site (rows, contribution banner; the leaderboard Payout column uses the same sentences without "Scored."):

- "Scored." (replaces "Counted.")
- Before the close: "Wallet and rules test done. The hold is checked after the close." · "Wallet and rules test done." (no hold rule) · "Not payable yet: {steps}." with steps from "link a wallet by signing", "pass the rules test", "earn points" (joined "a, b and c").
- After the close: "Payable: wallet, rules test and hold confirmed." · "Payable: wallet and rules test confirmed." · "Waiting for the hold check." · "Not payable: the wallet held less than the minimum after the close." · "Not payable: {why}." with whys from "no wallet was signed by the close", "the rules test was not passed by the close", "no points" (joined "; ").
- Epoch-level: "This epoch has no payout." · "See the epoch's settlement for this payout."
- Leaderboard column header: "Payout".

Bot /me:

- "To be paid for epoch {n}:" · "To be paid for epoch {n} (closed):"
- "✅ Wallet: {AbCd…WxYz}, signed" · "❌ Wallet: {AbCd…WxYz} is pasted, not signed" · "❌ Wallet: none signed yet" · "❌ Wallet: none signed by the close"
- "✅ Rules test: passed" · "❌ Rules test: not passed yet" · "❌ Rules test: not passed by the close"
- "⏳ Hold: read once after the close; needs at least {100,000 MYCEL} in that wallet" (or "…needs the minimum balance set in the rules in that wallet" when the amount cannot be read) · "✅ Hold: none required" · "⏳ Hold: being checked" · "✅ Hold: confirmed" · "❌ Hold: under {100,000 MYCEL} after the close" · "➖ Hold: not checked, since the wallet or rules test was missing"
- "Next: link a wallet by signing. It is free and moves no funds." · "Next: take the rules test. Every answer must be right." · "Next: earn points by replying to a raid." · "Nothing else to do now."
- "Epoch {n} has no payout." · "Epoch {n} is published. Its settlement on the site shows each payout."
- Buttons: "Link my wallet" (opens `t.me/<bot>?start=link_<community>`), "Take the rules test" (`?start=rules_<community>`).

Score message (one line under the score, then a button):

- "Not payable yet: link a wallet by signing before the epoch closes."
- "Not payable yet: pass the rules test before the epoch closes."
- "Not payable yet: link a wallet by signing and pass the rules test before the epoch closes."
- Buttons as for /me.

Developer-facing (public OpenAPI route descriptions): contributions "…each with its selected judgement and its member's payout status: what the payout gate would decide as of the read (the hold is read only after the close)."; leaderboard "…Each with its payout status."; contribution "…and its member's payout status."

## What the release needs

- No migration, no new environment variable, no rubric, program or scorer change.
- A fresh-session Codex review of `2380d59..8f82146` before any push: it touches the payout gate (an extraction, behavior unchanged) and the reward message path.
- Cisco's approval of the copy above and the open questions below.
- Deploy API, worker and web together after the hold. The web reads `payout` as optional, so web before API is safe; API before web only adds a field.

## Open questions (Cisco)

1. **Privacy.** The API and site now show, per member id, whether the rules test was passed (wallet status was already public). The score-message line is posted in the group under the member's reply, so the group sees that this member has no signed wallet or no pass. Accept, or keep the line to /me only?
2. **Token name.** /me names the hold "100,000 MYCEL" using the rubric's community code. Right for MYCEL; another community would need a token symbol field.
3. **Wording.** "rules test" everywhere, matching /setup and /rules, rather than "quiz".
4. **Once per epoch.** The line rides on the member's first sent score message of each epoch. Members who already got a score message in the epoch that is open at release see it from the next epoch.

## Known limits

- Like the gate, the read path looks up the wallet link once per member (up to 100 small queries for a full page).
- Rows, leaderboard and contribution reads compute the epoch's live selection once more to know each member's points before the snapshot.
- The site does not show the hold amount (it has no token decimals); /me does.
