---
date: 2026-10-02
summary: Professional community pilot guide, role split and posting cadence; fresh browser presentation reads remain empty, no production or social write.
---

# Community guide checkpoint

## TL;DR

Cisco confirmed “iFailab” means the Hyphae Lab Telegram group. [The operating guide](../community/OPERATING-GUIDE.md) answers where members participate, how separate communities work, what current scores mean, how to divide responsibilities and what to post. Next: use the existing pilot with verified pins and a small willing cohort; agree the bounded participant onboarding design before implementation. No UI change, paid scoring call, synthetic work, production registration, funding, message or post.

## State and evidence

- Start `0b1cd61992f39bec6b69788b22d97ce45a59e768 = origin/main`; its exact-SHA CI `37040306523` succeeded at the previous readiness close. Guide milestone `b1431489aec99d20e99630f0eb9e992ecc984f33` is committed; shipping/gate receipt follows. Resolve final SHA with `git log -1 -- docs/HANDOFF.md` and verify Actions for that SHA.
- October 2 17:55–17:58Z live browser read-back: epoch 2 open, rubric 1.2.0, 0 contributions/count, leaderboard 0 contributing members, no payout. Epoch page visually inspected at widths 1689/390; neither overflowed. Home, community and leaderboard mobile reads also had no horizontal overflow. No wallet connection/claim or dark-mode journey was tested anew.
- Community page initially displayed 17:02Z as-of, then 17:57Z on revisit; no cache cause established. Refresh and inspect read timestamps rather than asserting real-time availability.
- Prior 17:02–17:08Z database/deployment/program reads remain in [the readiness receipt](2026-10-02-payout-readiness.md). This follow-up did not reread worker backlog/schema/authority/hash and does not relabel them as fresh.
- Code inspection: unique mint/chat community registration, community-scoped members and `/me`, registered-admin-only `/raid`, private rules test and current website links. Latest active task is chosen for linked submissions; operate one active brief at a time. Legacy seed script is not a complete modern production onboarding path. Multi-community self-service/scale is unproven.

## Recommendations and owner inputs

- Each future community keeps its own group plus bot/dashboard; retain operator-assisted onboarding until a second independently verified community and onboarding checklist exist. Same-mint multi-chat work needs design.
- Existing MYCEL pilot: propose “MYCEL · Contribution Pilot / Powered by Hyphae,” consistent official links, short pinned member instructions, one support contact and a clear public-data notice. Live rename/UI remain unperformed. Owner supplies genuine invite, contact and publishing account; recommendation: reuse the registered group rather than recreating production state.
- One coordinator, an editor/operator and 5–10 willing contributors; roles may overlap. Cisco retains current admin/reward authority. Private issue inventory only; no like/reply squads or altered rewards policy.
- One useful original post/day, 5–7/week; optional second distinct update. About 2–3 contribution briefs/week only when non-overlapping windows/review capacity permit. Two-week editorial experiment, not an algorithm guarantee. Current X policy was checked; no platform-compliance certification or campaign execution.
- Pending professionalism work: verified group-to-website links, obvious member actions, plain-language score/eligibility explanations and evidence-backed operator onboarding. Custom domain, delegated roles and self-service are separate improvements, not current capabilities.
- October 8 attended C14–C18; 23:00Z intake pause, final C18b after 23:45Z before October 9 00:00Z with author attestation/before-close corrections. October 9 C19–C22 only after close/snapshot/hold/safety gates. No contributor payment or mainnet community/vault evidenced. Approved funding rulings unchanged.

## Validation and stage

Browser/code/link inspection and staged diff check passed. Fresh required gate: `pnpm test` **727 passed, 1 skipped** (106 core, 80 web, 541 API), `pnpm typecheck` exit 0, `pnpm lint` exit 0 (266 files). Strict canonical handoff validation passed with existing sibling-candidate/GitHub path warnings; local guide links and resume paths verified. Both docs milestones ship together; final exact-SHA shipping CI result is reported at session close. Documentation/screenshots only; no DB/reward behavior change or new sensitive implementation review. Candidate/rules/Jev refs and registration freshly unchanged; preserve untracked `wsl`.

Runner: Codex, GPT-6 family. Exact runtime model ID/effort/token/cost telemetry unavailable; no helpers or paid model calls. Research used the available web tool and primary X/Solana sources linked in the guide; posting frequency is an editorial recommendation.

## Suggested skills

`handoff-memory`, `superpowers:brainstorming` for participant-flow design, `frontend-design` for subsequently authorized UI work, `content-strategy-sms`/`social-media-trends-research` for planning, `handoff`. Use an original-post skill only when actual post drafting is requested; no helpers or external publication here.

## Generated artifacts this session

| What | Canonical home | Notes |
| --- | --- | --- |
| Operating guide | `docs/community/OPERATING-GUIDE.md` | Public participant/operator guidance; no private plan copied |
| Real epoch screenshots | `docs/community/2026-10-02-epoch-2-desktop.png`, `docs/community/2026-10-02-epoch-2-mobile.png` | Empty live state at 17:55–17:56Z; not fixtures/payment proof |
| Checkpoint | `docs/HANDOFF.md`, `docs/BUILDLOG.md`, this snapshot | Machine-portable; browser scratch files removed |

No credentials, keys, deployments, jobs or published content created.

## Next-session prompt

```text
Resume Hyphae's community participant-flow preparation. Cisco confirmed Hyphae Lab is the Telegram pilot. The guide and real empty-state screenshots exist; naming/UI/self-service proposals are unimplemented, no social publication or contributor payment. Browser reads are October 2 17:55–17:58Z; reuse separately timestamped readiness receipts without calling them fresh.
Files: CLAUDE.md, AGENTS.md, docs/HANDOFF.md, docs/community/OPERATING-GUIDE.md, docs/handoffs/2026-10-02-community-guide.md, docs/demo/2026-10-08-first-payout-readiness.md.
Model: GPT-6.1 Sol (high) — bounded participant-flow design and documentation.
Skills: handoff-memory, superpowers:brainstorming, frontend-design, handoff.
Agree the bounded member onboarding design, using real group invite/support contact supplied by Cisco. Preserve the frozen runtime, SDK 0.1.0, candidate/rules/Jev/folders/wsl and October 8–9 gates. Do not execute C14 early, register/fund another production community, send messages or publish posts.
```
