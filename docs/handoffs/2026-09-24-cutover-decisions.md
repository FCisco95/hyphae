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

## Runbook B — cutover window

**Status:** steps 0–8 ran on 2026-09-24 (`2026-09-24-cutover.md`, production on `main` `b7bfe55`). **Step 9, the token re-rotation, is still open.** This section is the complete runbook, with every correction from the Sep 24 run folded in, so it can be followed on its own for a repeat or a rollback.

### How to run it

- Every step is a hard stop: Cisco says yes before it runs, and reports the result before the next one.
- **One step per message.** The agent gives Cisco exactly one step, then waits for his output.
- **Cisco runs every Fly and Neon-write command in his own PowerShell terminal**, from the repo root, `C:\Users\joao_\Desktop\DEVELOPMENTS\hyphae`. The agent's auto-mode classifier refuses `fly deploy` and production migrations, and it should.
- Secrets never pass through a paste from Telegram Desktop into PowerShell (on Sep 24 that broke `fly secrets set`). They are read from the gitignored repo `.env`, which Cisco edits in an editor. Non-secret values such as `LINK_ORIGIN` can be typed.
- `fly logs --no-tail` hangs and prints nothing here. Use `fly logs --app hyphae-api` and stop it with Ctrl+C.
- Scripts that import `apps/api/src/db.ts` parse the full app env, so `.env` must hold every required variable (including `LINK_ORIGIN`), even for a database-only script.
- The agent does read-only Neon checks itself: `node --env-file=.env <script>` with `postgres` resolved from `packages/db`, inside `sql.begin("read only", …)`.

### Steps

0. **Preconditions.** Runbook A passed. The full local gate is green on the exact `main` commit being deployed: `pnpm -r test`, `pnpm -r typecheck`, Biome on tracked files (`git ls-files -z '*.ts' '*.json' '*.js' | xargs -0 pnpm exec biome check`), `pnpm --filter @hyphae/db exec drizzle-kit check`, `pnpm --filter @hyphae/api test:pg` (Docker Desktop running), `git diff --check`.
1. **Read-only Neon checks (agent).** The migration journal has exactly the expected rows, and their hashes match the files. The tables the new migrations create do not exist yet. Record the row counts the migrations touch (for 0008: `select count(*) from members`, the backfill size).
2. **Stage new secrets without restarting (Cisco).** For example `fly secrets set LINK_ORIGIN=https://hyphae-api.fly.dev --stage --app hyphae-api`. `fly secrets list --app hyphae-api` shows it as Staged.
3. **Apply the migrations in one run (Cisco).** From `packages/db`: `node --env-file=..\..\.env node_modules\drizzle-kit\bin.cjs migrate`. Expect `migrations applied successfully!`.
4. **Post-checks (agent, read-only).** The journal has the new row count with matching hashes; new tables, enum values and columns exist; backfills match the counts from step 1; original data unchanged; the running bot still answers `/health` 200.
5. **Deploy (Cisco), from the repo root, not `apps/api`:** `fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --app hyphae-api --depot=false`. The Dockerfile copies the lockfile and `packages/` from the root; `--depot=false` avoids the builder that hung at "Waiting for depot builder…". Note the new image id and the previous one (the rollback image).
6. **Verify.** `/health` 200; `GET https://hyphae-api.fly.dev/link` and `/link/app.js` 200; staged secrets show Deployed; the worker log shows `reward-recovery` and the queues it consumes; `/link` in Hyphae Lab answers with the deep link and a real wallet links; `/me` shows it as verified.
7. **Bootstrap (Cisco), only for a community's first reward epoch:** from `apps/api`, `node --env-file=..\..\.env --import tsx scripts/set-rubric.ts <mint> <rubric.json> --activate-at <iso>`. The ISO time needs `Z` or an offset. Check first that the rubric file equals the live `communities.rubric`, so legacy scoring doesn't change.
8. **BotFather menu (Cisco):** `/setcommands` lists exactly the commands the bot handles.
9. **Rotate the bot token once more (Cisco), after step 6.** The image this deploy replaced (Sep 17) logged the bot token whenever a handler failed. The token was already rotated once on Sep 24, but that token then ran on the same Sep 17 image until the deploy, and Fly's log retention cannot prove it was never logged. So:
   1. BotFather: `/revoke`, choose `@hyphaeprotocol_bot`, copy the new token. Revoking also clears the webhook, so the bot is deaf until 9.4.
   2. Put it in `.env` as `TELEGRAM_BOT_TOKEN=…` in an editor. Do not paste it into PowerShell.
   3. Set the Fly secret from `.env` (this restarts api and worker on the same image):
      ```powershell
      $t = ((Get-Content .env | Select-String '^TELEGRAM_BOT_TOKEN=').Line -split '=', 2)[1].Trim()
      fly secrets set "TELEGRAM_BOT_TOKEN=$t" --app hyphae-api
      ```
   4. Re-set the webhook, dropping updates queued while it was down:
      ```powershell
      $s = ((Get-Content .env | Select-String '^TELEGRAM_WEBHOOK_SECRET=').Line -split '=', 2)[1].Trim()
      Invoke-RestMethod -Method Post "https://api.telegram.org/bot$t/setWebhook" -Body @{ url = 'https://hyphae-api.fly.dev/telegram'; secret_token = $s; drop_pending_updates = 'true' }
      ```
   5. Verify: `Invoke-RestMethod "https://api.telegram.org/bot$t/getWebhookInfo"` shows the URL, `pending_update_count` 0 and no `last_error_message`; `/me` in Hyphae Lab answers. Then `Remove-Variable t, s`.

### Rollback

- **Before step 5:** nothing to undo in the app. The migrations only add tables, columns, enum values and indexes; the running image ignores them.
- **After step 5:** from the repo root, `fly deploy --config apps/api/fly.toml --app hyphae-api --image registry.fly.io/hyphae-api:<previous image>` (Sep 24: `deployment-01M2R8W6Z6NAAWYM6KT2ZDYA2H`; `fly releases --app hyphae-api --image` lists the refs). The schema stays; migrations are never rolled back.
- **A rollback to the Sep 17 image brings the token logging back.** Rolling back therefore also means repeating step 9 once a fixed image is deployed again, and keeping the rollback window as short as possible.
