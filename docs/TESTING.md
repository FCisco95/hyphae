# Testing Hyphae in Hyphae Lab

This page is the checklist for testers joining the Hyphae Lab Telegram group. The first section covers what the deployed bot does today (production `b7bfe55`, deployed 2026-09-24). Anything marked **planned** is built or scheduled but not live.

## Before you start: what is public

Hyphae is an audit trail, so the work you submit is meant to be checked by anyone. Once the public audit page is live (planned), it shows for every contribution:

- the post link and the text the bot captured, or the text you submitted with `/submit <text>`;
- the raw and credited score, why they differ, the points, and every correction with its reason;
- your Hyphae member number (a random id), and your wallet **only if you linked it by signing**.

It never shows your Telegram id, username or a pasted wallet. If you don't want something public, don't submit it.

## What you can do today

1. **Join the Hyphae Lab group** and find the bot, `@hyphaeprotocol_bot`.
2. **Link a wallet by signing.** Send `/link` in the group. The bot answers with a link to a private chat. There it checks you're in the group and sends a one-time page link that lasts 15 minutes. Open it, connect Phantom or Solflare, and sign the readable message. Signing is free and moves no funds. `/me` then shows your wallet as verified.
   - A wallet another member already linked is refused.
   - Don't forward the page link; it is yours only.
3. **Wait for a raid.** An admin opens one with `/raid <X post link>`. Full credit for the first 6 hours, dropping to zero at 48 hours.
4. **Do the work on X.** Reply to the post or quote it, about the post itself. Generic hype earns nothing; the rules are in `docs/rubrics/`.
5. **Submit it:** `/submit <link to your reply>`, `/submit quote <link to your quote>`, or `/submit <text of your work>`.
   - The bot answers `Received for this epoch. Scoring against its pinned rubric…`, then replies with the score, any flags and the reasoning.
   - One reply and one quote per member per raid; a post can be submitted once.
6. **Nominate your best work for effort:** `/effort <link or text>`. Once per weekly epoch, one piece of work can earn a 3× effort multiplier if it shows original, inspectable work that helps the community. A rejected nomination still uses your slot.
7. **Check the epoch:** `/me` in the group shows the current epoch, your entries, exact points and whole points.

## Epochs and rewards

- Epochs are seven days. **Epoch 1: 2026-09-25 00:00 UTC → 2026-10-02 00:00 UTC.** Epoch 2 runs to 2026-10-09 00:00 UTC.
- The rules of an epoch (rubric, multiplier, prompt) are pinned when it opens and never change while it runs.
- **Points are not money.** Nothing has been paid.
- **Epoch 1 is never paid**: under the approved rules, the first paid epoch must open after the rules test is live, and it wasn't. Its points stay on record.
- **Planned:** epoch 2 may become the first paid epoch, if the rules test and the token-hold check are live before it opens. To be paid you would need a wallet linked by signing, at least 100,000 MYCEL held at the close, and a passed rules test. This will be announced in the group when, and only if, it is live.

## What to report

Send a message in the group, or to the admin, with the link to your submission:

- **A score you think is wrong.** Say what you expected and why. Disagreement is how the rubric improves; corrections are public and keep the original score beside them.
- **A missing reply.** You got `Received`, but no score came within a few minutes.
- **A confusing reason.** The reasoning doesn't match your post, or a flag makes no sense.
- **Any error message** from the bot, copied exactly.

## Known limits

- **Images and video aren't seen.** The scorer reads your post's text through X's public embed. Put your point in the text. An effort nomination that depends on media waits for evidence instead of being judged blind.
- **`/me` in a private chat** answers that the chat isn't a registered community; send it in the group. (Fixed on `main`, not deployed yet.)
- **A late score counts for nothing.** Work scored after the epoch's close stays on record but earns nothing in that epoch.

## Planned (not live yet)

- **The public audit page**: every contribution of every epoch, the leaderboard, and each decision's reasoning and history.
- **The rules test** and the **token-hold check** (100,000 MYCEL), both needed before any payout.
- **On-chain claim**: a merkle root per epoch and a claim with proof, first on devnet.
