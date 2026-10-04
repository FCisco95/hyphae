# Registered-Lab phone release gate — October 4

Last Updated: 2026-10-04T09:38:47Z

## TL;DR

**Needs Cisco; requested result not achieved.** Starting main **40a9b4c294e3fca60ab405a9051f60fbc4d557ef**,17 ahead of unchanged origin **312cc0ffae1c4efbf5fd69c2b58a5aaf98af28ac**. Reviewed combined source **e5ee300d** remains unchanged. Fresh release checks pass; actual live signing-page hashes differ from the reviewed local output. Publication/deployment hold and operator-access guards remain. Next human step: approve only the exact **P1+D2 publication/automatic web deployment/old-web rollback** row in the existing [combined packet](../demo/2026-10-04-combined-release-packet.md#current-result-gate--october-4-release-checks). No new packet or product implementation.

## Fresh checks and evidence

- `pnpm test`: exit0, **851 passed/1 optional skip** (106 core,107 web,638 API).
- `pnpm typecheck`, `pnpm lint` (286 files), DB `drizzle-kit check`: each exit0.
- API `test:pg`: exit0, **50/50**, disposable local Postgres Docker container stopped by script; no Neon test.
- API and web production builds: exit0. Local Node24.14.0/pnpm10.29.3. No release container or Vercel artifact generated.
- Source bounds: **7 trees/17 file hashes/13 migrations** match existing pins; post-e5ee300d tracked changes docs only. SDK exact0.1.0 throughOct12. Accepted participant/setup reviews reused; no new sensitive delta.
- Fetch no-prune/ff-only: origin unchanged,17/0 before closure; held rules/Jev/reward/tag preserved. No reset/merge of parked work or sibling/vault write.
- Fresh Vercel project/deployment reads: correct project/team/root/Node24, main Git deployment enabled and aliases automatic; production READY **dpl_G3xB3NRa78G9UR5GzZmXmsBa62mz** from **312cc0ff**. Existing rollback help inspected. Private configuration equality remains unproved, not failed.
- **09:36–09:37Z**: public health, `/v1/communities/<MYCEL mint>`, epoch2 and selected website200; Lab name/intake open, cutoffOct9 00:00Z. First exploratory `/api/communities` returned404 because source mounts reads at `/v1`; corrected canonical route200, no service failure inferred.
- Live `/link` and `/link/app.js`200/no-store/no-referrer/restrictive CSP. Their hashes differ from local reviewed build; see packet. No private signing URL/token or real wallet used.

Local ignored API output SHA-256 (validation only):

| File | SHA-256 |
|---|---|
| `apps/api/dist/server.js` | `0b8784733903dc39070e0be8fbe9d40858734873413e1cf4258a6c49784abe7f` |
| `apps/api/dist/worker.js` | `a5c254c17c9f15f333dcc54d838257595e38db89c687396f09e3858fcb93fd43` |
| `apps/api/dist/public/app.js` | `3c8ad562d2226b52a66834057ed30dfee8aad823b7534974a0134e1d52a24b38` |
| `apps/api/dist/public/index.html` | `c63c15d1cd764bc559748b598ff8f28abc2fe55684d96a35b5c2965471424cb6` |

## Held steps and downstream impacts

P1+D2 awaits the one concrete conditional approval, then private config proof before execution. Its source publication does not deploy T/B. D1-build's new registry digest and current API/worker configs remain UNKNOWN without existing operator access; API-only update must preserve frozen v11 worker. T1 waits for live artifact, valid own-account test scope and Cisco attendance. Guide one action, say what to look for, then wait; no device PASS was observed.

Genuine invite/support URLs remain absent and optional production actions stay omitted. No rename, menu/message/pin, group upgrade, activation, registration or real setup. Pilot hidden/recruitment blocked until real phonePASS. Existing founder link/scoring history accepted. Organic owns authority/settings/provisioning; reuse reviewed per-token paused operator setup, public settlement GET only. No invented self-service or C1–C13 replay.

Original [Oct8–9 runbook](../demo/2026-10-08-first-payout-readiness.md) unchanged: admin0.02SOL/gross500000000lamports/fresh exact top-up/permanent recipient retain original approvals; no early execution. Pause **Oct8 23:00Z**; final audit **AFTER23:45Z**, author corrections/attestation **STRICTLY BEFORE Oct9 00:00Z**; postclose snapshot/hold/safety/Ledger publication/genuine C21/C22. Hold through **Oct10 00:00Z inclusive**. Empty/no-payable means no payment. `/link` message proof cannot clear C21.

## Pending local commits

All remain unpushed under the recorded publication hold. The closure commit's exact full SHA resolves with `git log -1 --format=%H -- docs/handoffs/2026-10-04-phone-release-gate.md` and is stated in the approval question. It contains only this receipt, HANDOFF, BUILDLOG and the existing packet amendment. The full17 preceding SHAs are:

```text
e7667747fcdf6d04b860f554df43a4cd18a8ec22 docs: align onboarding evidence and prepare T/A/B scope
d26357e101195019688b981c3ab6c938d1a8ed73 docs: record local scope packet and publication hold
0e97582ac0d1a7e84d52084330c3f9b32708a707 feat: guide participants through bot and community onboarding
5907a76402aac87d4592168b9a7d521ba78ce6e2 fix: keep onboarding usable at narrow zoom
e003cdf114fc5bd50bf767fb8fa84b855c940e52 feat: preserve original private links for wallet-browser handoff
5e4b994b8de5fdfcaadd6f583b3ff179f9383385 fix: validate owner presentation without a runtime test dependency
8f395b43b2c7d79d00fad9ef074c62cf33228ae0 fix: harden onboarding interactions after independent review
8841a01e8abdcec4398f1255a8ccd3d1c9423212 fix: keep closed-epoch guidance consistent
072e99ba7918ed30c36bacd5c6cbb66255ec55b5 docs: record reviewed local onboarding candidate and activation gates
51e6c47533a46c49ef5c28a5e8fde71516f9fc0f feat: add guarded community setup for independent token groups
4ddf0bc21a141992b7548b7cbdc7b63904114a3d fix: pin setup database targets and require verified production TLS
cd4c4ef8a3ed4b47669ecd2dd0c4cd73ed9b437f test: cover setup identity refusal and replay after activation
6b31fc6936c54e57a19c9673b4554beb40ab714c docs: record approved shared community setup and remaining integration gates
e5ee300d6ce65231ec2325fef60be1f1ecbcba05 docs: close shared setup integration on local main
315e85b32633b1add3cc48476e40d06511ad7154 docs: reconcile completed local onboarding and setup continuation
28367f37a48c9bb66a5ee2955b9cf32fca871491 docs: prepare combined release and attended readiness packet
40a9b4c294e3fca60ab405a9051f60fbc4d557ef docs: record read-only configuration access limits
```

## Suggested skills

`handoff-memory`, `vercel:vercel-cli`, `security-review` for any new sensitive delta or authorized deployment, `handoff`. No unchanged-code review, helper or Sentinel product work.

## Generated artifacts this session

| What | Home | Stage |
|---|---|---|
| Existing release row amendment | `docs/demo/2026-10-04-combined-release-packet.md` | Local conditional scope only |
| Portable state/receipt/buildlog | `docs/HANDOFF.md`, this snapshot, `docs/BUILDLOG.md` | Local, publication held |
| Ignored API/web build output | `apps/api/dist`, `apps/web/.next` | Local validation only; not deployed artifacts |

No credentials, registry image, deployment, message, registration, wallet signature, transaction or schedule generated. Actual runtime model/effort and usage were not independently inspected here; do not borrow prior counters.

## Next-session prompt

```text
Resume only FCisco95/hyphae. Result still Needs Cisco: reviewed T/A/B/setup built and accepted, fresh release gate851/1skip+Postgres50/50 and both builds0, but live signing-page hashes differ; no release or actual phonePASS. Start at closure SHA from git log -1 -- docs/handoffs/2026-10-04-phone-release-gate.md; preserve all local and held refs, no-prune/ff-only check.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/handoffs/2026-10-04-phone-release-gate.md, docs/demo/2026-10-04-combined-release-packet.md, docs/demo/2026-10-04-combined-source-pins.json, docs/community/SETUP-INTEGRATION.md, docs/demo/2026-10-08-first-payout-readiness.md.
Model: gpt-6.1-sol (high) — October4 recorded routing for bounded release/attended runbook work; recommendation, not current-runtime attestation.
Skills: handoff-memory, vercel:vercel-cli, security-review for new sensitive deltas/deployment, handoff.
Resolve Cisco's exact P1+D2 approval only; prove its private config guards before push, verify actual Git/web artifact and perform only the scoped rollback if needed. D1-build/API are separately held, current Fly/bot/DB settings and new digest UNKNOWN; preserve frozen worker. After live API artifact and attended own-account scope, guide registered Lab phone journey one step at a time and record actual surface/free-message/same-wallet me PASS or FAIL. Keep other blockers in handoff, stop prep loops. Pilot hidden/recruitment blocked untilPASS; SDK0.1.0 throughOct12, rules/Jev held and originalOct8–10 money/attestation/hold gates unchanged. No early funds, empty means no payment, no sibling/vault writes.
```
