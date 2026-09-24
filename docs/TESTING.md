# Testing Hyphae in Hyphae Lab

This page is for testers in the Hyphae Lab Telegram group. The first section covers only what the deployed bot does today (last recorded 2026-09-17). The second section, marked **planned**, covers what changes once the new reward stages ship.

## What you can do today

1. **Join the Hyphae Lab group** and find the bot, `@hyphaeprotocol_bot`.
2. **Link a wallet:** `/link <your Solana wallet address>`.
   - The address is pasted, not verified by signature, and you can change it later.
   - No payout exists yet, so a devnet or empty wallet is fine.
3. **Wait for a raid.** An admin opens one with `/raid <X post link>`. The bot posts the target text and the window: full credit for the first 6 hours, dropping to zero at the end (48 hours by default).
4. **Do the work on X.** Reply to the post or quote it. Say something about the post itself; generic hype earns nothing.
5. **Submit it:** `/submit <link to your reply>` or `/submit quote <link to your quote>`. You can also submit text directly with `/submit <text of your work>`.
   - The bot answers `Received. Scoring against rubric <version>…`.
   - Each member gets one reply and one quote per raid, and a post can be submitted only once.
6. **Read the scored reply.** A few seconds later, the bot replies in the thread with:
   - `Score N/100`, plus `(raw R, reason)` when a rule or timing changed the number
   - any flags, such as `off_topic` or `ai_slop` with the patterns it saw
   - the model's reasoning
7. **Check your total:** `/me` shows your linked wallet, how many contributions were scored and a running points total.

The rubric the scorer uses is public: `docs/rubrics/` (current and past versions) and `docs/rubrics/CHANGELOG.md` (what changed and why).

## What to report

Send a message in the group, or to the admin, with the link to your submission:

- **A score you think is wrong.** Say what you expected and why. Disagreement is useful: it's how the rubric improved from 1.0.0 to 1.2.0.
- **A missing reply.** You got `Received`, but no score came within a few minutes.
- **A confusing reason.** The reasoning doesn't match your post, or a flag makes no sense.
- **Any error message** from the bot, copied exactly.

## What not to expect

- **Points aren't money.** Nothing has been paid, and no on-chain claim exists yet.
- **`/me` totals aren't epoch rewards.** `/me` adds up every score you've received so far. It isn't limited to the current week, and it isn't a payout amount.
- **Images and video aren't seen.** The scorer reads your post's text through X's public embed. If your point is in an image, put it in the text too.
- **`/propose` and `/rubric` do nothing yet.** They appear in the bot's command menu but aren't built.
- **Scores can change by re-grade.** When the rubric changes, an admin may re-grade old work. The new score is added next to the old one, and both stay on record.

## Planned (not live yet)

These are built or scoped but not running in the group. Nothing here works until an announcement says it's live.

- **`/effort <link or text>`**: nominate one piece of work per week for the 3× effort multiplier. Plain `/submit` never uses it. Effort nominations for posts with media the bot can't read wait for evidence instead of being scored blind.
- **Seven-day epochs** with rules pinned at the start of each week. A rubric change can't touch a week that's already open.
- **`/me` for the current epoch only**, showing each contribution's current decision.
- **A frozen snapshot at each weekly close**, followed by a public audit page with every score, its reasoning and its rubric version.
- **Verified wallet linking** before any real payout. `/link` in the group will answer with a private link to the bot. The bot checks you're in the group and sends a one-time page link that expires in 15 minutes. On that page your wallet signs a readable message: free, and it moves no funds. `/link <address>` stops working; a wallet linked the old way keeps scoring but is marked not verified in `/me` and can't be paid until you sign. A wallet another member already holds is refused.
