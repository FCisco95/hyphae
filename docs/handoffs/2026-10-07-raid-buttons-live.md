---
date: 2026-10-07
summary: Late-night session: up to 3 open raids, raid length buttons and /raids Close menu live on image buttons-ed32b4f; Sonnet 5.5 scorer parked.
---

# Hyphae snapshot, 2026-10-07 late night

## What shipped
- 777a5b8: `MAX_OPEN_RAIDS = 3` (was one active raid, a pilot policy). Image `raids-777a5b8` `sha256:5185a5ecbed5647703b5fe0a9f31365dcf200e1f929a595993f22669fbd36e50`.
- 135e900, ed32b4f: bare `/raid <link>` shows 6/12/24/48h buttons; `/raids` lists open raids with Close buttons; post ids over 19 digits refused (Codex finding). Image `buttons-ed32b4f` `sha256:fa0b2c955b16e7096c629aebeb6c65ca46337ba3365d75e254c59c655529a5ed`, API and worker.
- Records 0dd4cb9, 9f67137. No migration. Codex (gpt-6-astra, xhigh, read-only): ACCEPT on the raid limit; REJECT then ACCEPT on the buttons after the id-length fix.

## Evidence
- Gate on a clean `origin/main` plus commits copy: API 878 passed / 3 skipped, web 123, test:pg 73 of 73 (run with `HYPHAE_TEST_PG_PORT=<free port>` when another session holds 55432), lint and typecheck 0.
- Fly: `fly image show` both machines on buttons-ed32b4f; `/health` 200; no errors in logs.

## Decisions
- Cap of 3 open raids, a ceiling only to stop one admin flooding the chat; each raid keeps its own one reply and one quote per member.
- Sonnet 5.5 medium NOT shipped: per session notes it scored R2 and P3 (legit, expected-pass) at 0 on all runs vs 68 to 78 on Sonnet 5. Parked on `feat/sonnet55-medium`; not yet in a committed calibration file.

## Risks
- Other sessions (Jev, Haiku 5.5) will deploy too: build from origin/main >= ed32b4f.
- `fly machine update --image <digest>` is rejected by Fly; use the tag.

## Next
- Cisco tests the buttons on his new post; scorer choice (Haiku 5.5 or Jev) in the owning sessions before 2026-10-08T12:00Z.
