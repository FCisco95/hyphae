---
date: 2026-09-24
summary: Cisco accepted the three session-end recommendations. Cutover order is manual wallet check first, then one window for migrations 0006–0008, LINK_ORIGIN, deploy and bootstrap. LINK_ORIGIN is https://hyphae-api.fly.dev, because api.hyphae.fun does not exist. The hold gate gets its own plan after the cutover. Includes the manual-check and cutover runbooks. Nothing executed.
---

# 2026-09-24 — cutover decisions and runbooks

## Decisions

Cisco, in-session, replying to the three open questions in `2026-09-24-session-end.md`: **"I'm on board with your recommendations."**

| # | Question | Decision |
|---|---|---|
| 1 | Cutover order | Manual wallet check first. Then one window: apply 0006–0008 together, set `LINK_ORIGIN`, deploy, bootstrap. |
| 2 | `LINK_ORIGIN` | `https://api.hyphae.fun` if it points at the Fly app, otherwise the Fly app's own origin. Checked read-only 2026-09-24: `api.hyphae.fun` does not resolve (NXDOMAIN) and `hyphae-api` has no Fly certificates, so **`LINK_ORIGIN=https://hyphae-api.fly.dev`** (`/health` 200). Adding a custom domain later changes only proofs issued after the change, because each proof lives 5 minutes and is single-use. |
| 3 | Hold gate (guide §6) | Its own plan, after the cutover. |

These decisions set the order only. Each hard-stop step below still needs Cisco's separate yes when it runs: the Neon apply, the Fly secret, the deploy and the bootstrap.

## Runbook A — manual wallet check (local, no Neon, no production bot)

Needs Cisco: a test bot token and a Tailscale Funnel. Never use `@hyphaeprotocol_bot` or Neon for this.

1. BotFather: create a test bot. Create a test supergroup and add the bot. Run check 7 below once with the bot **not** an admin.
2. Tunnel: `tailscale funnel 8080`. Note the `https://<machine>.<tailnet>.ts.net` origin (Funnel must be enabled on the tailnet). cloudflared and ngrok are not installed on this machine.
3. Local Postgres: `docker run -d --rm --name hyphae-manual -p 55433:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=hyphae postgres:17`.
4. `apps/api/.env.manual` (gitignored by `.env.*`): `DATABASE_URL=postgres://postgres:test@127.0.0.1:55433/hyphae`, `TELEGRAM_BOT_TOKEN=<test bot>`, `TELEGRAM_WEBHOOK_SECRET=<random ≥16 chars>`, `LINK_ORIGIN=<funnel origin>`, `LINK_CHAIN=solana:mainnet`.
5. Migrate the local database: from `packages/db`, `DATABASE_URL=postgres://postgres:test@127.0.0.1:55433/hyphae pnpm exec drizzle-kit migrate`.
6. Seed the test community: from `apps/api`, `SEED_MINT=ManualTestMint SEED_CHAT_ID=<test group id> SEED_ADMIN_ID=<your Telegram id> node --env-file=.env.manual --import tsx scripts/seed-community.ts`.
7. Run the **built** server, since `tsx` dev mode has no `/link/app.js`: `pnpm --filter @hyphae/api build`, then from `apps/api` run `node --env-file=.env.manual dist/server.js`.
8. Point the test bot at it: `https://api.telegram.org/bot<token>/setWebhook` with `url=<funnel origin>/telegram` and `secret_token=<the webhook secret>`.
9. Checks (plan Task 8 step 3):
   1. `/link` in the group posts only the `t.me` deep link.
   2. The private chat returns the page URL. A non-member gets "Join … first".
   3. Phantom and Solflare each show a readable message and no other prompt.
   4. `/me` shows the wallet as verified.
   5. Opening the same URL again shows "expired or already used".
   6. A second member proving the same wallet gets the `wallet_taken` text.
   7. With the bot not an admin in a supergroup, `getChatMember` still answers for the requesting user. If it doesn't, the bot must be an admin, and that goes in this runbook.
10. Teardown: `deleteWebhook` on the test bot, stop the funnel, `docker stop hyphae-manual`, delete `.env.manual`.

Record the result in `docs/BUILDLOG.md`, with each check passed or failed.

## Runbook B — cutover window (each step on Cisco's yes; Cisco runs Fly commands in his own terminal)

0. Preconditions: Runbook A passed; the full local gate is green on the `main` commit being deployed.
1. Read-only Neon checks: the migration journal has exactly 6 rows (0000–0005) whose hashes match the files; `reward_epoch_snapshots`, `link_sessions` and `member_wallet_links` do not exist; record `select count(*) from members` (the size of the 0008 backfill).
2. Stage the secret without restarting: `fly secrets set LINK_ORIGIN=https://hyphae-api.fly.dev --stage --app hyphae-api`.
3. Apply 0006, 0007 and 0008 in one run: from `packages/db`, `pnpm exec drizzle-kit migrate` against Neon (the same method as the 0003–0005 apply, `2026-09-23-migrations-applied.md`).
4. Post-checks: the journal has 9 rows; `member_wallet_links` row count equals the member count, every row `method = 'paste'` and `valid_to is null`; the original data is unchanged.
5. Deploy: `fly deploy` from `apps/api`.
6. Verify: `/health` 200; the worker log shows `reward-recovery` and `reward-close`; `/link` in Hyphae Lab answers with the deep link; `GET https://hyphae-api.fly.dev/link` serves the page.
7. Bootstrap MYCEL: `scripts/set-rubric.ts <mint> <rubric.json> --activate-at <iso>` (the ISO time must carry `Z` or an offset).
8. BotFather menu: add `/effort`, and change the `/link` description to "link your wallet (signed)".

Rollback before step 5: the migrations only add tables, columns, enum values and a partial index; the running Sep 17 image ignores them. After step 5, roll back with `fly deploy` of the previous image; the schema stays.
