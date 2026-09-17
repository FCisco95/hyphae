# Hyphae build log

One entry per work session, newest first. Written so it can be read aloud as a script.

## 2026-09-17 (afternoon) · Day 4 of 28 — billing, keys, bot polish, submission text

**Shipped:** account chores that were blocking Day 2 scoring work. Anthropic verified live via a real API call from the `hyphae` key ($20 org credit already present — the $0.00 balance in the prior handoff was stale). DeepSeek topped up $5, key `hyphae` created and staged as a Fly secret (`fly secrets list` confirms `DEEPSEEK_API_KEY` staged, not yet deployed — nothing reads it until Day 2 code ships). Fly billing confirmed in good standing, card charged automatically, no trial banner. BotFather Task 1.7 finished: `/setcommands` (link, submit, raid, propose, me, rubric), `/setdescription`, `/setuserpic`. Colosseum submission: appended the no-token disclosure to the "anything else judges should know" field (rewritten tighter to fit the 500-char cap alongside the existing prior-work disclosure); accelerator fields 5 (eight months) and 6 (Lisbon, open to SF) confirmed saved.
**Decisions:**
- Fee cut ruled at **3%**, taken off the top of the settlement pot before contributor shares split — no individual contributor's share is reduced by it. Confirmed scope: this is the Hyphae protocol cut on settlement (locked decision #6), not the Organic fee-tracker line.
- AI scoring cost has no ceiling in the current plan — flagged as a post-hackathon scaling item (cheap/local model triage before the paid call), not a Week 1–4 task. Recorded in the vault plan, not built.
**Numbers:** $20.00 Anthropic credit verified live · $5.00 DeepSeek balance · 0 secrets un-staged on Fly · 2 Colosseum fields corrected.
**Commits:** (docs only this session — see `git log`)
**Next:** Day 2 — oEmbed capture + scoring job (separate terminal).

## 2026-09-17 · Day 4 of 28 — core, database, and the bot is live on Fly

**Shipped:** `apps/api` deployed on Fly (`hyphae-api`, Paris) as two process groups from one image: `api` (Hono, `/health` and the Telegram webhook, secret-token verified) and `worker` (idle stub until scoring lands). Bot `@hyphaeprotocol_bot` answers `/start`, `/link <wallet>` (validated with `@solana/kit`, upsert per community + Telegram user, refuses a wallet already linked to someone else) and `/me`. Telegram webhook pointed at the Fly URL. `packages/db` — Drizzle schema for the seven tables (communities, members, tasks, contributions, scoring runs, epochs, leaves), first migration generated and applied on Neon. Contributions and scoring runs are append-only by convention: a correction is a new row, so the audit trail never loses history. And `packages/core`, test-first. A sha256 merkle tree with domain-separated leaves (`0x00`) and internal nodes (`0x01`) so a node can never be replayed as a leaf, sorted-pair hashing so root order doesn't matter, odd nodes promoted unchanged. Deterministic epoch settlement (`none` or `sqrt` stake weighting, per-wallet cap, remainder dust stays in the vault, never redistributed). The scoring contract: rubric schema (zod), canonical JSON for stable hashing, the scoring prompt that quotes contributor content as `<content>` data rather than instructions, a linear timing multiplier, and an evidence hash that changes whenever the model, rubric version, or output changes.
**Decisions:**
- Verified `@noble/hashes` v2 import paths (`sha2.js`, `utils.js`) against current docs before writing the merkle code — v2 consolidated `sha256`/`sha512` into `sha2.js` and requires the `.js` extension on every import.
- Settlement rounds down and leaves dust in the vault rather than redistributing it — simpler, and the loss per epoch is bounded by wallet count, not worth the complexity of a remainder pass.
- Workspace packages are bundled into the api image by tsup, so the runtime `node_modules` is only third-party code. pnpm 10's `deploy` needs `--legacy` for that layout; documented in the Dockerfile.
- Every bot reply is a Telegram reply-to, so group threads stay readable when several testers are active.
- **Organic retired its own scoring lane; Hyphae is the engine.** The parent platform was building a second, private scorer for the same job. Two scorers means two answers to "why did I get this score", and only one of them is auditable — so the platform keeps identity and the community page, and every score in every Organic community is computed here, against a published rubric, with the reasoning shown.
- MYCEL rubric v1.0.0 settled with the founder: credit floor at 60 (below it pays nothing, so spam is worth zero rather than "a bit"), hard zero on any guideline breach, one reply and one quote per member per raid, full credit for 6 hours decaying to zero at 48h — the window X itself stops distributing in. Min hold 100,000 MYCEL, per-wallet cap 25% of the pot until 20 paid contributors then 15%.
- Quality and worth are separate axes. The rubric grades quality 0–100; a published per-task-type weight decides what the work was worth, with diminishing returns for repeating one type. Unverifiable tasks pay little by design — work that can't be proven must be cheap, or it becomes the exploit.
**Numbers:** 14/14 tests passing · 7 tables on Neon · 2 Fly machines (api, worker) · 1 community registered (Hyphae Lab, MYCEL mint) · 1 wallet linked · 0 contributions · $0.00 scoring spend.
**Commits:** f9b1c3c, 8ef4c6e, c32f447, 58111ef, 7b4bb3d, dc40b51
**Next:** BotFather command menu, then Day 2: oEmbed capture and the scoring job so `/submit` answers with a score and its reasoning.

## 2026-09-16 (evening) · Day 3 of 28 — toolchain and scaffold

**Shipped:** the workspace. pnpm monorepo, Anchor 1.0.1 program at the root that builds and emits its IDL, Biome for lint, LF enforced. WSL toolchain complete (Node 22, pnpm 10, Rust 1.90, Anchor 1.0.1, solana-cli 3.1). Infrastructure provisioned: Fly app `hyphae-api` with secrets staged, Neon Postgres in Frankfurt (round-trip verified), Telegram bot `@hyphaeprotocol_bot` live and admin of the `Hyphae Lab` test group, Anthropic key verified.
**Decisions:**
- `anchor-lang` pinned to exactly 1.0.1 to match the CLI. Cargo had resolved 1.2.0 on its own; a CLI/crate mismatch is a class of IDL bug not worth debugging mid-hackathon.
- Generated mocha test stays until week 3 replaces it with LiteSVM. No dead scaffolding beyond that: `app/` and prettier dropped at init.
**Numbers:** 0 testers on the bot yet · 0 contributions · $0.00 scoring spend.
**Commits:** 600a4fa, f705c5f
**Next:** `packages/core` merkle test-first, then settle, rubric, Drizzle schema, bot on Fly.

## 2026-09-16 · Day 3 of 28 — plan locked

**Shipped:** the design and the 4-week plan. Week 1 is hour-by-hour; testers touch the bot on Saturday.
**Decisions:**
- Scores are computed off-chain and every epoch's full score set is committed on-chain as a merkle root, so an unfair score is provable. Chain writes scale with epochs, not contributions.
- One vault per community, one permanent deposit address. Anyone can fund it; contributors claim with a proof and receive soulbound Token-2022 points in the same transaction.
- Stake weighting is a per-community rubric setting (`none` or `sqrt`), published and hashed into the epoch. The protocol does not pick the economics; it makes them auditable.
- Long-running pieces (Telegram webhook, job queue, epoch keeper) run in containers on Fly. The public pages run on Vercel. Postgres on Neon, jobs in pg-boss, no Redis until Postgres says so.
- Every AI score records the model, rubric version and prompt hash. Switching models is visible in the audit trail by construction.
**Numbers:** 0 testers on the bot yet · 0 contributions · $0.00 scoring spend.
**Commits:** see `git log` for this date.
**Next:** toolchain, accounts, workspace scaffold tonight; DB + merkle + bot on Fly tomorrow.
