---
date: 2026-10-07
summary: What changed in Hyphae on 2026-10-07 and the new direction for the Organic / vault side, with a proposed Organic integration contract (spawn a community, fund its vault, read status, by API and script), the member-funnel cuts, the founder decisions they need, and the ready prompt. Written from the Hyphae repo only; nothing outside it was written.
---

# Organic-sync brief (2026-10-07)

From: Hyphae session, Windows, Claude Opus 5.5 (effort high). To: the Organic / Brain `organic-sync` run. Sources of truth in this repo: [HANDOFF](../HANDOFF.md), [ROADMAP](../ROADMAP.md), [BUILDLOG](../BUILDLOG.md). Engineering truth comes from this repo's code and receipts; the vault reconciles plans and claims against them. The previous brief, [2026-10-06](2026-10-06-organic-sync-brief.md), still holds for what it lists; this one adds to it.

## Cisco's direction (2026-10-07, his words, condensed)

"The better these results are, the better the score." Asked by an evaluator "can you set up a new community, fund a wallet, and show which wallet it is?", Cisco cannot answer today. Setup should be straightforward, with buttons ("open this, create this"), and usable through an API. Organic should be able to spawn a community and its payments with a script. Engagement is too hard: "no one is doing it, so I need to make it easier." **Plan without dates:** keep improving until Cisco calls a stop. The payout safeguards (the first payout sitting and its deploy hold) stay unless Cisco lifts them explicitly.

## Correction from Cisco (2026-10-07, later the same day): these are Organic communities

The contract below said "spawn a Hyphae community". Cisco corrected it: **the community is an Organic community.**

- **Organic's job (automatic, when a token bonds on Organic's launchpad):** create the community page inside Organic, a Telegram group already configured with the bots, its channels, and the treasury wallets. "All have automatically created."
- **Hyphae's job:**
  1. the engine that Organic's automation calls: register the community, return its vault, report status;
  2. a way to create other communities manually inside Hyphae (an operator path, for communities that are not on Organic);
  3. a sign-in where a member or admin sees their tasks, evaluations and money;
  4. a general public page with a leaderboard of tokens being paid and Organic users, showing the least information about holders that still proves the payouts.

**Uncomfortable fact for the Telegram part:** Telegram's Bot API cannot create a group or a channel. Only a user account can, through Telegram's user API (MTProto). Two ways to get "a Telegram already configured":

| Option | What it takes | Risk |
|---|---|---|
| **One-tap group link (recommended)** | Organic shows the owner one link, `t.me/hyphaeprotocol_bot?startgroup=<code>&admin=<rights>`. Telegram creates or picks the group and adds the bot as an admin with those rights in one step. Hyphae matches the code to the registered community. | One tap by the owner. No automated Telegram account. |
| Fully automatic | An Organic-owned Telegram user account, driven by MTProto, creates the group and channel and adds the bots. | A user account automated at scale can be limited or banned by Telegram. It also needs its own credentials and custody. |

**Least information on the public page (recommendation):**
- Per community: tokens paid, SOL paid, number of paid members, and epochs.
- Per member: the shortened verified wallet (already public on Solana), points, and SOL paid.
- No Telegram name, ID or X handle unless the member opts in. Contribution receipts already show the X link of each scored post; the leaderboard does not add identity on top of that.

**Sign-in (recommendation):** Telegram Login. Every member already has a Telegram identity, and with earn-first a wallet is optional until payment. A wallet sign-in (Sign-In With Solana) can be added for wallet-only views.

**Decision 1 below is answered by this correction:** Organic's automation is the authority for Organic communities, and an operator creates the others. Decision 2 (who holds each community's publisher key) stays open. Cisco mentioned treasury wallets created by Organic; whether the publisher key is one of them is his call.

## What changed on 2026-10-07 (pushed, `0d14bd0`)

| Change | Evidence |
|---|---|
| Prompt-injection check: 7 injection replies, 3 runs each, all credited 0 (21 of 21, highest raw 5); a real reply with an injection was not inflated. Open rubric question: the scorer flags injection attempts as `guideline_breach`, which the "never" list does not cover | [result](../rubrics/eval/reward-eval-2-injection.md) |
| Security and trust page live at `https://hyphae-delta.vercel.app/security` and in [SECURITY.md](../SECURITY.md): admin powers, keys, verifiable build, AI review index ("not a third-party audit"), privacy and deletion | [Codex fact-check](../reviews/2026-10-07-security-page.md): NEEDS-FIXES, fixed, ACCEPT |
| Security reports go through GitHub private vulnerability reporting on `FCisco95/hyphae-program` (enabled, verified) | Cisco's ruling, [build log](../BUILDLOG.md) |
| Retention: kept while the community runs; on request within 30 days, delete Telegram ID, username and X handles and end the wallet link; on-chain data and public receipts stay. Deletion is by hand (no tool) | Cisco's ruling, build log |
| Both repos are **public**; Cisco ruled `FCisco95/hyphae` stays public, so the Colosseum collaborator step is not needed | `gh repo view`, handoff |

Live services unchanged: API and worker on `sha256:def68189…` since 2026-10-06T20:24Z; one pending proposal (`reward-eval/2`, epoch 3).

## Built later on 2026-10-07 (committed locally, not pushed, not deployed)

| Change | Commit |
|---|---|
| **One-tap Reply on X / Quote on X** buttons on the group raid message and the private raid alert. They open X's composer already attached to the raid post | `4457da6` |
| **Vault visible before the first payout:** `GET /v1/communities/:mint` gains a `vault` section (network, vault address, admin, fee recipient, balance, what published epochs owe), read from the bound community account with fail-closed checks. The community page shows "Fund this community", or "do not send SOL" until the vault is confirmed. Additive inside v1: the SDK's loose schema accepts responses without it | `9b75532` |
| **Earn before linking** (Cisco's ruling): a group member can submit and take the rules test before linking a wallet; payment still needs a wallet signed before the close. Migration `0015` makes `members.wallet`, `link_method` and `linked_at` nullable (set together) | `a25eec3` |
| Codex review fixes: group commands and rules passes ask Telegram for membership every time | `94ce60e` |

These need a deploy: migration 0015 on production, then the API, then the worker. Each needs Cisco's own yes. Once wallet-less members exist, rolling the API back to the old image is unsafe (the old `/me` assumes a wallet).

## Where it is hard today (facts, with the file that shows it)

**For a member, before one point pays:**
1. Join the group.
2. Link a wallet by signing. This is required **before they can even submit a reply** (`apps/api/src/bot/commands/submit.ts:36`).
3. Pass the rules test, every answer right.
4. Reply on X, then paste the link back into Telegram.
5. Hold the community's minimum token balance at the close (100,000 MYCEL for Hyphae Lab, rubric `minHoldUnits`).

The bot's `/setup` checklist shows steps 1 to 4 with buttons (`apps/api/src/bot/commands/setup-content.ts`). Five link sessions so far, two completed.

**For a community owner or Organic:**
- Setup is an operator command-line tool with a private manifest, a reviewed plan hash and a private environment file ([setup guide](../community/SETUP-INTEGRATION.md)).
- No bot button, no API, no self-service.
- Creating the community on chain (`initialize_community`) is a separate signed step by the publisher key.

**For anyone asking "which wallet do I fund?":**
- The vault address appears in the API only after an epoch is published (settlement and claim leaves).
- The community page does not show it before then.
- The README shows how to derive it from the mint and the admin key.

## Proposed Organic integration contract (to agree; not built)

The aim is one script on Organic's side, `spawn community → fund → watch`, using only HTTP and one signature.

1. **Register.** `POST /v1/integrations/communities`, server to server, authenticated with an Organic integration key; Organic is the authority that a token community's owner asked for it.
   - Body: mint, name, owner's Telegram user ID, publisher public key, fee recipient, rubric template.
   - Returns: community ID, `community_address` and `vault_address` (program-derived, so Organic can check them), status `awaiting_group`, and an **add-to-group link**.
2. **Add the bot with one tap.** The add-to-group link is Telegram's bot deep link `https://t.me/hyphaeprotocol_bot?startgroup=<one-time code>&admin=<rights>`, which asks the owner to pick a group and confirm the bot's admin rights. The owner taps it, picks or creates the group, and Telegram adds the bot as admin. The bot matches the code to the registration, checks the owner is a group admin, and the registration becomes `awaiting_chain`.
3. **Create on chain.** `GET /v1/integrations/communities/:id/initialize-transaction` returns an unsigned `initialize_community` transaction. The publisher key signs it (Organic's key, the owner's wallet, or a Ledger, per the custody decision below). Hyphae watches for the account; status becomes `ready`.
4. **Fund.** An ordinary SOL transfer to `vault_address`, for example from Organic's bagworker sweep. `GET /v1/communities/:mint` shows the vault address, network and balance.
5. **Watch.** The existing read API and Organic's existing settlement adapter (`epoch.settlement`) need no change.

The same steps work from a Hyphae command, `hyphae community create`, for an operator without Organic, and from bot buttons for a group owner (`/register` in the group, then the same flow).

**What Organic decides or provides:**
- **Who may spawn a community.** Recommendation: Organic's verified owner check is the authority. Hyphae trusts a signed integration request, not a Telegram admin role alone; this keeps the existing safeguard that group admin status does not prove token ownership.
- **Who holds each community's publisher key.** This is the main custody decision. Recommendation: the community owner's own wallet, signing each publish through a prepared transaction, so Hyphae and Organic never hold another community's payout key. The Ledger stays MYCEL's key.
- **The integration key exchange.** A credential change, done by Cisco.
- **The Organic-side script.** It lives in `organic-app`; that repo's session builds it.
- **The steward/council role contract.** Still open; the designated-admin fallback stays until it exists.

## Proposed member-funnel cuts (each needs Cisco's yes where marked)

1. **Earn before you link** (Cisco: rule wording). Accept replies from a member with no wallet; they still need a signed wallet by the close to be paid, as the payout rules already say. This removes the wall in front of the first reply.
2. **One-tap reply.** Raid messages and alerts get "Reply on X" and "Quote on X" buttons (X's web intent, `https://x.com/intent/tweet?in_reply_to=<post id>`, and for a quote the same intent with the raid post's URL), then "Paste my link". No rule change.
3. **Rules test at the payout gate, not the front door** (Cisco: rule). The test stays required for payment, but a member can earn points first.
4. **Minimum hold** (Cisco: economics). 100,000 MYCEL blocks anyone without the token. Options are his: keep it, lower it, or set it to 0 for a trial epoch. A new value takes effect only through a new proposal at the cooldown boundary.
5. **Funnel counts.** Joined, linked, rules passed, first reply, credited, paid, as counts only, so each cut can be measured.

## Proposed operator and evaluator answers (no rule change)

1. **"Which wallet is it?"** The community page and API show the vault address, network and live balance before the first epoch, with a copy button and how to fund it.
2. **"Set up a new community."** One command (`hyphae community create`) runs registration, the add-to-group link and the on-chain transaction end to end, recorded once on devnet as a receipt.
3. **A demo script** that shows spawn → fund → score → publish → claim on devnet, from Organic's point of view, using only the public API and one signature.

## Stale claims the vault should correct

1. "The Hyphae repo is private / add `hackathon@colosseum.com` as collaborator": both repos are public, and Cisco ruled this one stays public.
2. "Security contact and retention wording outstanding": decided and published (above).
3. Any plan that treats Oct 8 to 12 as the end of the work: Cisco said to plan without dates until he calls a stop. The payout sitting and its deploy hold are unchanged unless he lifts them.

## Founder decisions needed, in recommended order

1. Who may spawn a community: Organic's verified owner check (recommended), operator approval, or group admins.
2. Who holds a new community's publisher key: the owner's wallet (recommended), Organic's key, or a Hyphae-held key.
3. Earn-before-link and rules test at the payout gate (yes recommended).
4. The minimum hold for epoch 3 onward.
5. Whether "instructing the grader" becomes a published zero.

## Ready prompt for the Brain terminal

```text
/organic-sync post-ship
Source: the Hyphae repo docs/handoffs/2026-10-07-organic-sync-brief.md, then docs/HANDOFF.md and docs/ROADMAP.md (read them; do not write to the Hyphae repo).
Read the "Correction from Cisco" section first: these are Organic communities, created automatically by Organic when a token bonds; Hyphae is the engine it calls, plus manual creation, a sign-in view and a public payouts page with minimal holder information. Reconcile the vault's Hyphae and Organic notes with: the 2026-10-07 injection check and security page (live), the private-vulnerability-reporting contact, the retention ruling, both repos public (no collaborator step), and Cisco's direction to plan without dates until he calls a stop (payout safeguards unchanged). Record the proposed Organic integration contract (register by API, one-tap add-to-group link, unsigned initialize transaction, vault funding, existing settlement read) as a proposal, not a built feature, and list the five founder decisions with the recommendations. For organic-app, draft the Organic-side work as a separate plan (owner verification as the authority, the integration key, a spawn-fund-watch script); do not build it from the vault. Correct the three stale claims. Keep strategy and judging reasoning in the vault; the Hyphae repo carries only engineering facts. Do not change reward, epoch, payout or rubric rules.
```
