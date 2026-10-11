# Post-payout release approval sheet

Prepared October 11. Original reviewed next: 1249fed. Privacy accepted at f573a68 (review record on next 9d0da9b); claim recovery accepted at main cc4f773. **No exact E0–E6 production authorization received.** Deploy cutoff: October 12 12:00Z, except single-commit link/README fixes.

## One-screen release copy

| Surface | Member-visible examples that will ship |
|---|---|
| Public scoring / private checklist | Public: “Scored.” Group /me: “Open your checklist in private chat.” Button: “Open my private checklist”. Only the member in private chat sees “To be paid for epoch {n}:”, their rules-test result, hold check and next step. |
| Wallet record | “Wallet record”; “Points from an open epoch are provisional, and points do not promise payment.”; “{amount}, paid in {tx}”; “No public record”. |
| Raid stats / public recap | “5 members took part: 4 replies, 2 quotes.”; “Credited so far: 3 of 6, average credited score 71.”; “2 still being scored and may be credited later.” |
| Claim / Blink | “Share claim link on X”; “Connect wallet”; “{wallet} connected” with the full address; “Waiting for your wallet… Check its approval window.”; after 60 seconds: cancel the pending request before retrying; “I cancelled it — check again”. |
| Epoch 2 schedule | “Schedule change”; “This epoch closes on 2026-10-10 00:00 UTC: 1 day later than its configured window of 7 days, which would have ended on 2026-10-09 00:00 UTC.”; links to the recorded reason. |

**Privacy selected by Cisco:** “Authorize the privacy change: public aggregates only; member checklist private (recommended)”. Public API, pages and group scores omit per-member rules-test/hold verdicts. A private checklist checks current community membership and uses the authenticated Telegram sender. Existing public on-chain payout receipts remain public.

**Reviews and evidence:** [privacy ACCEPT](../reviews/2026-10-11-privacy.md), [claim-page ACCEPT](../reviews/2026-10-11-claim-page.md), [judge links](2026-10-11-judge-links.md), [local screenshots](screenshots/2026-10-11/README.md). E0 combined gate runs only after the authorized merge; no image, migration, machine update or main push has run.

**Required production authorization:** exactly **yes, run the post-payout release (E0–E6)**. Covers the history-preserving merge, combined gate, exact image, db.mjs precheck → 0018 → 0019 → postcheck, API, worker, main web push and smoke. E7–E8, scorer amendment, announcements, new payouts and epoch 3 publication remain excluded.

**Copy precedence:** the full branch-note quotes below are historical reviewed copy. Their public per-member eligibility sentences and first-score hints are superseded by the selected privacy rule. The checklist sentences survive only in the member’s private chat.
## Full branch-note copy


### 2026-10-08-payout-status.md


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



### 2026-10-08-wallet-record.md


Web, `/wallet/[wallet]`:
- Eyebrow "Wallet record". Lead: "The epochs where this was a member's wallet, verified by signature, when the epoch closed or while it is open."
- Stats: "Communities", "Epochs", "Contributions" (note "{n} scored, {n} credited"), "Average credited score", "Exact points".
- Explainer: "Scored: the contribution has a judgement. Credited: scored above zero. The average is over scored contributions. Points from an open epoch are provisional, and points do not promise payment."
- Community table: "Community", "Epochs", "Contributions", "Average score", "Exact points".
- Epoch card: heading "{community} · Epoch {n}" with the existing Open, Closing or Final pill; "{opens} → {closes} · member {id}". Stats "Contributions", "Average credited score", "Exact points", "Payout". Table "Work", "Submitted", "Credited score", "Points", "State" (the state sentences are the existing ones).
- Counts: "{n} contribution(s): {n} scored, {n} credited." / "{n} contribution(s): none scored yet."
- Payout:
  - "{amount}, paid in {tx}"
  - "{amount} allocated, not claimed yet." plus the link "Claim page"
  - "{amount} allocated. {existing unavailable sentence}"
  - "No allocation for this wallet in this epoch."
  - "No payout before the epoch closes and is published."
  - Otherwise the existing sentences ("Not allocated. No payout exists for this epoch.", "Retained: this epoch is before the first paid epoch.", the chain sentences).
- "No epochs on this page."; pager "← Newer", "Older →", "{a}–{b} of {n} epochs".
- Empty state: "No public record", "No epoch shows this wallet.", "A wallet's record lists the epochs where it was a member's wallet, verified by signature, when the epoch closed or while it is open. It starts with that member's first contribution. A wallet that was only pasted, not signed, has no record."
- Page metadata:
  - Title: "Wallet {short}".
  - Description: "{n} epoch(s) in {n} communit(y/ies). {counts sentence} {points} exact points."
  - Description when there is no record: "No public record for this wallet."
  - Description when it can't be read: "This record can't be read right now."
- Links: the verified wallet on the leaderboard, epoch and contribution pages, and the wallet on the claim summary, are now links (no new text).

API docs (OpenAPI):
- Summary "A wallet's record", with three description paragraphs: the attribution rule; the definitions and payout; and "No contribution link is served here".
- 404 "No epoch's public reads show this wallet."
- Parameter "A Solana address: base58 for exactly 32 bytes."



### 2026-10-08-raid-stats.md


### `/raids` (admin, in the group)

```
Open raids (2 of 3):

#1 @owner · ends 2026-10-08 18:00 UTC (5h 12m left)
https://x.com/owner/status/123
Replies 4 · Quotes 2 · Credited 3 · Avg credited score 71

#2 @other · ends 2026-10-09 06:00 UTC (17h 12m left)
https://x.com/other/status/456
Replies 0 · Quotes 0 · Credited 0

Closing stops new submissions; existing work and credit stay.
```

New pieces: the `(… left)` suffix (`(under a minute left)` below one minute) and the stats line. The header, the URL line and the last line are unchanged.

### Raid length picked (edits the "How long should this raid run?" message)

```
Raid set for 24h. Ends 2026-10-09 18:00 UTC.
```

### Recap (public, in the group)

Closed by the admin:

```
Raid closed — @owner:
https://x.com/owner/status/123
Ran for 11h 42m.
5 members took part: 4 replies, 2 quotes.
Credited so far: 3 of 6, average credited score 71.
2 still being scored and may be credited later.
Epoch 2 results: https://<PUBLIC_WEB_URL>/c/<mint>/e/2
```

Window over, one submission, work in two epochs:

```
Raid ended — @owner:
https://x.com/owner/status/123
Ran for 12h.
1 member took part: 1 reply, 0 quotes.
Credited so far: 0 of 1.
Epoch 2 results: https://<PUBLIC_WEB_URL>/c/<mint>/e/2
Epoch 3 results: https://<PUBLIC_WEB_URL>/c/<mint>/e/3
```

Nobody submitted:

```
Raid ended — @owner:
https://x.com/owner/status/123
Ran for 6h.
No submissions.
Results: https://<PUBLIC_WEB_URL>/c/<mint>
```

The header mirrors the opening message ("Raid open for 24h — @owner:"); `@owner` is the X post's author, already public in that message. Durations read `5h 12m`, `12h`, `42m` or `under a minute`. Link previews are off.



### 2026-10-08-blink.md


Web page:
- `Share claim link on X` (claim page and receipt page, published epochs only)

Blink card (GET):
- Title `Claim · <community> · Epoch <n>`
- Button `Claim`
- Description `<amount> SOL to <n> members, published on <devnet|mainnet>. Use the wallet you verified with the bot; it signs and pays for its own claim.`
- A disabled card's description is the epoch page's existing sentence (`unavailableSentence`).

POST success message:
- `Claim <amount> SOL from <community>, epoch <n>. Your wallet pays the network fee and the claim receipt's rent.`

Errors:
- `This is not a Hyphae claim link.`
- `Connect a Solana wallet to claim.`
- `This epoch does not exist.`
- `Hyphae can't be read right now. Try again in a minute.`
- `This wallet has no payout in epoch <n>. Use the wallet you verified with the bot.`
- `This wallet already claimed epoch <n>.`
- `This claim can't be checked right now, so nothing was built. Try again in a minute.`
- Not published, or the chain cannot confirm: the existing `unavailableSentence` text.



### 2026-10-09-payout-fix.md


/me:

- `Current link: {AbCd…WxYz}, signed` · `Current link: {AbCd…WxYz}, pasted`, on its own line under the wallet check when the current link is not the wallet the verdict used.
- `➖ Hold: not checked, since there were no points`
- After the close, for a not-payable member: `Not payable: {why}.` with the site's existing whys, `no wallet was signed by the close`, `the rules test was not passed by the close`, `no points`, joined by `; `. Also `Not payable: the wallet held less than the minimum after the close.` These sentences are new in the bot; the site already uses them.

Score message: no new string. The hint is now left out when the bot's username cannot be read within 3 s, or when the epoch closed during that lookup.



### 2026-10-09-blink-fix.md


| Case | Status | Text |
|---|---|---|
| Body over 1 KiB | 413 | `That request is too large.` |
| Not JSON | 415 | `Send the request as JSON.` |
| Body cut off mid-read | 400 | `That request could not be read. Try again.` |
| Already claimed | 409 | `This wallet already claimed epoch 2. Transaction: https://explorer.solana.com/tx/<signature>` (devnet adds `?cluster=devnet`) |

The 400 string is a fourth one the brief did not name; it was needed for the stream-failure path, which the review wanted distinct from the invalid-wallet message.
