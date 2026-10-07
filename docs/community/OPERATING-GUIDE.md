# Community launch and operating guide

**Current continuation — October 4:** source/checkpoint `e5ee300d6ce65231ec2325fef60be1f1ecbcba05` contains completed, independently reviewed T/A/B onboarding and operator-assisted setup. Both remain local-only, unpushed/undeployed. The owner-doc patch is applied. Next gate: combined release/target preflight, genuine owner inputs and separately authorized attended phone/setup/live scope; no rebuild of accepted source. [Current handoff](../HANDOFF.md).

Prepared October 2; reconciled October 3, 2026. The [participant design](../superpowers/specs/2026-10-03-participant-onboarding-design.md) and [bounded implementation plan](../superpowers/plans/2026-10-03-participant-onboarding-plan.md) are now implemented and reviewed as a local candidate; unpushed/undeployed. See [the implementation receipt](../handoffs/2026-10-03-onboarding-implementation.md). This guide activates no community, changes no rewards and authorizes no production write. The registered pilot still displays **Hyphae Lab**; the approved participant-facing name is **MYCEL**.

## Where people participate

Use each community's own Telegram group, with the shared Hyphae bot and a dedicated community page on the website. Members keep their existing Telegram, X and wallet accounts. They do not need a separate app installation or to join every other community's group.

Reuse the existing registered MYCEL pilot, correcting its display name later through the [guarded operator plan](../superpowers/plans/2026-10-03-mycel-display-name-operator-plan.md). Keep it small and clearly labeled as a pilot. For future communities, add the bot to their existing group rather than moving everyone into Hyphae Lab. A separate lab remains useful for demonstrations and support, with test activity clearly distinguished from real contributions.

| Community owns | Hyphae provides |
| --- | --- |
| Its name, group, content and designated administrator | Shared bot and website |
| Published rules and contribution briefs | Community-scoped intake, scoring reasons and audit pages |
| Its approved budget and community-specific vault | Publication and claim tooling, subject to the stated publisher/custody policy |
| Member support and genuine-author confirmation | Evidence, revision history and public read API |

The code already identifies communities by a unique mint and Telegram chat; membership and epochs are scoped to the community. The chain derives a community/vault from mint plus admin. **The current database supports one registered chat per mint**, not several independent workspaces for the same token. Subcommunities, Discord, delegated admin roles, custom branding controls and self-service onboarding need separate design and verification. No isolation/load claim for many live communities has been demonstrated by this pilot.

New-community onboarding is currently operator-assisted. An operator must verify the mint, group, administrator, current reward configuration, schedule, publisher and immutable fee recipient before the attended initialization/funding gates. Adding the bot alone does not register or fund a community. The legacy `apps/api/scripts/seed-community.ts` uses old defaults and is not a complete production onboarding procedure.


Founder context, October 3: MYCEL already has Buy Calls (Safeguard), Trenches, Raid Team (Raidar), Announcements and a two-member Mycel Testers group with one external tester. This is an existing stack, not a blank community to create. Owner screenshots now show Hyphae Lab and Mycel Testers are separate chats, with two Mycel Testers entries in the MYCEL list. Lab has historical Hyphae bot replies for this mint; Testers membership does not confer Lab membership. Recommend retaining the registered Lab, adding that existing chat to the MYCEL Community if offered by Telegram, and inviting the tester there. Verify the exact chat before a live change; no move/rename/registration has occurred. Group membership is not scored uptake. [Raid decision memo](../superpowers/specs/2026-10-03-raid-system-decision-memo.md): the recorded October 3 choice is one disjoint Hyphae paid brief in the registered chat with Raidar campaigns separate. No live task or other-bot setting changed.


Ownership is confirmed: Cisco created Lab, and the bot is its admin. The September 24 handoff explicitly recorded Lab as a **basic group**. Telegram's Community chat capacity is defined for supergroups/channels ([primary documentation](https://core.telegram.org/tdlib/options)); basic-group type is the leading explanation for the missing Add a Chat entry, **not a freshly confirmed live type**. Follow [the placement/upgrade plan](../superpowers/plans/2026-10-03-lab-community-placement-operator-plan.md): read current type, preserve the existing community, and require approved in-place upgrade/migration read-back if needed. No upgrade or placement is done; no ownership question remains.

## Current links to pin

- [MYCEL community](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg)
- [Epoch 2: contributions, scores and settlement state](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2)
- [Epoch 2 leaderboard](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2/leaderboard)
- [Official bot](https://t.me/hyphaeprotocol_bot)
- [Published rubrics](https://github.com/FCisco95/hyphae-program/tree/main/rubrics) and [pilot custody policy](https://github.com/FCisco95/hyphae-program#custody-during-the-pilot)

The alias above is the evidenced website; a custom domain is a future improvement until ownership, routing and certificates are verified. Pin the permanent community link as the main destination and the current epoch link as a dated shortcut. Replace epoch shortcuts each week. Never manufacture a Telegram invite: Cisco supplies the actual group invite when inviting people.

## Professional pilot checklist

**Cisco's confirmed community name: MYCEL**, with “Powered by Hyphae” as attribution and “Pilot” as a status badge. The live API still says Hyphae Lab; the registered Telegram title/permissions have not been freshly read in this session. A rename must be applied consistently through an authorized metadata operation before claiming it is live; keep the existing community identity, members, scores and history. Do not hardcode MYCEL into the shared views for every community.

- Use the existing logo and consistent name, description and official links across the group, bot, website and X profile. Verify each account and link before inviting people.
- Pin one short “Start here” guide: purpose, official links, wallet linking, rules, accepted evidence, deadlines, score explanation and a named support contact.
- Link both ways: group description to community page; community page to a verified group invite and bot. The current page has a bot link in its footer but no verified group invite or member onboarding checklist.
- Explain the next action before technical details. Proposed community-page actions: **Join community**, **Link wallet**, **Read rules**, **Open this week's contributions**. These are built in the local candidate, not deployed buttons; group commands and pinned-epoch instructions remain the actual workflow.
- Explain score states in ordinary language: pending, scored, provisional, final, excluded/corrected; distinguish raw quality, credited quality and exact/whole points. Put eligibility next to rewards rather than hiding it in a leaderboard.
- Keep evidence links, correction history, UTC deadlines and “data as of” visible. A leaderboard position is not a payment promise. Show “no payout exists” until a publication is confirmed; show “paid” only with a confirmed claim transaction.
- Tell members before submission that their work/evidence and linked wallet may appear in the public audit. Collect only the identifiers required for operation; keep contact lists, private messages and author attestations out of public docs.
- Check mobile layout, links and the path from `/me` to a member's contribution. Use real empty states until real uptake exists; fixture screenshots are demonstrations.

**Observed, October 2 17:55–17:58Z:** the live epoch page rendered cleanly at desktop width 1689 and mobile width 390, with no horizontal overflow. Community, leaderboard and home were also read on mobile without horizontal overflow; those pages were not all visually audited in both themes. Epoch 2 displayed **0 contributions/0 counted**, leaderboard **0 contributing members**, and **no payout**. The community page first showed data as of 17:02Z, then 17:57Z on a second visit. This is consistent with cached reads refreshing, but the cache cause was not traced. Check timestamps after reload; these are point-in-time browser observations, not an uptime measurement or a new database/backlog audit.

**Fresh October 3 18:41Z read-only update:** API/site HTTP reads succeeded; API name Hyphae Lab, intake/epoch 2 open, rubric 1.2.0, contributions/counted/pending/leaderboard entries all 0, no settlement or payout. Finalized RPC slot 453017150: derived mainnet community/vault/epoch accounts absent. [Receipt and limits](../handoffs/2026-10-03-onboarding-preparation.md): no new rendered device proof, continuous uptime measurement, direct DB/job backlog read or owner author attestation. The October 2 screenshot observations below remain historical.

Real empty-state screenshots: [desktop](2026-10-02-epoch-2-desktop.png) and [mobile](2026-10-02-epoch-2-mobile.png), captured at 17:55–17:56Z. They are not fixture contributions or payment proof.

## Member journey with existing commands

1. Join the registered community group and read the pinned rules and public-data notice.
2. Send `/link` in that registered group; follow the private bot deep link. **On a phone, the signing browser must expose a compatible Wallet Standard wallet.** Telegram's no-provider surface cannot sign. Copy the original private bot URL, including its fragment, into the wallet app's own browser; the loaded page strips its address bar, so copying that address loses the token. Read [the platform verdict and fifteen-minute test](../superpowers/specs/2026-10-03-link-platform-verdict.md). A real Hyphae phone test is still pending; do not recruit on an assumed mobile PASS. The copy control is built locally, not deployed; close an old signing page before opening the original/fresh bot URL. Use only your own link, never a forwarded one, and never send it to support. Check the exact API domain and readable free message; cancel any transaction, approval or seed-phrase request. Confirm your own signed wallet via `/me`.
3. Send `/rules` in the group and complete the private rules test. For the current MYCEL rules all six answers must be correct; passing is only one payment condition.
4. Choose a brief you can help with. The registered admin can open a task using `/raid <public X post URL> [hours=…] [brief…]`. This is a production intake operation performed by the owner, not by this preparation session.
5. Submit your own genuine work: `/submit <reply URL>` or `/submit quote <quote URL>`. The bot also accepts `/submit <text of your work>`; whether it earns credit depends on the pinned rubric. A submitted artifact is not automatically eligible or counted.
6. Use `/me` in the group for your wallet/epoch summary and community link. Open the epoch's contribution evidence and leaderboard for score reasons and provisional totals.
7. Raise an evidence/score issue promptly with the named operator, before close. Claims become available only after close, safety/eligibility checks and confirmed publication.

Members use their own accounts and words. One reply and one quote per member per task is a technical ceiling, not a participation quota. Do not submit someone else's work, duplicate artifacts, copied scripts or fake examples into live intake. Handle binding alone is not proof of authorship; the owner still needs the final author/duplicate audit and attestation.

Up to **three raids can be open at once** in a community. Replies and quotes attach to the exact raid whose private Submit button the member taps; a pasted link never selects a raid. The one-reply, one-quote ceiling applies to each raid separately. `/help brief` lists every open raid. Close a raid with `/close_raid` to free a slot.

## Divide responsibilities

Start with one coordinator and roughly 5–10 willing contributors as an onboarding cohort, not a numerical success target. People can help in more than one role; no one has to post every day. Cisco retains production/admin and reward authority until delegated roles are explicitly designed and approved.

| Role | Responsibility | Concrete handoff |
| --- | --- | --- |
| Cisco: owner/operator | Official content, registered-admin tasks, policy, corrections, attended publication | Approve brief and deadlines; resolve evidence issues before close |
| One community coordinator | Welcome members, maintain pins, answer process questions | Private issue list: blocked step, necessary member ID, relevant evidence link |
| One content editor, which may be Cisco | Keep the daily post useful and factual | Proposed asset/topic plus source, single action and publication owner |
| Contributors | Explain, test, create or document useful work using their own accounts | Original artifact/evidence through the existing bot |
| One audit assistant, which may be the coordinator | Flag duplicates, missing authorship and confusing score reasons | Evidence checklist for Cisco; no power to alter scores or attest for another author |

Use a small private operating sheet with role, consent/availability, onboarding status and unresolved issue. Keep wallet/score truth in Hyphae; do not maintain a competing rewards spreadsheet. Do not split members into like/reply/repost squads or rotate accounts to inflate reach.

## Posting cadence and content mix

**Recommendation: one original post a day, 5–7 posts a week**, on the primary community account. A second post is justified by a distinct useful update or timely announcement. Start with this as a two-week experiment, not a claim about X's algorithm. Founder-account posts add personal context when there is something to say; they are not duplicate broadcasts of every community post.

In Telegram, share one concise daily update at most when it is useful, maintain the pinned guide, and answer questions normally. Open only one contribution brief at a time: around **2–3 briefs a week** if their actual windows and the operator's review capacity allow it. Daily content does not require a new task. Use the deadline printed by the bot and the earlier epoch intake cutoff; do not promise credit merely because a task window is still open.

| Pillar | Approximate share | Useful topics and format | Appropriate invitation |
| --- | --- | --- | --- |
| Product understanding | 30% | Short demo, onboarding walkthrough, one explained feature | Try it and describe a confusing step |
| Evidence and progress | 30% | Verified milestone, score explanation, correction example, clearly labeled devnet receipt | Inspect the evidence or ask a specific question |
| Community knowledge | 20% | Practical explainer, thoughtful discussion, original member insight with permission | Add an experience, question or substantive improvement |
| Participation and recap | 20% | A bounded contribution brief, deadline reminder, honest weekly recap | Choose useful work voluntarily; submit evidence if applicable |

Sample seven-post mix: two explainers/demos, two verified progress updates, one discussion, one contribution brief and one weekly recap. This is a topic plan, not finished posts or a publication schedule. For MYCEL, use MYCEL's actual purpose and the epoch's pinned MYCEL rubric; Hyphae product marketing is not automatically MYCEL reward work. Other communities choose relevant topics and prospective rules through their own approved onboarding process.

Current research offers relevant angles around [earning trust through public evidence](https://solana.com/news/solana-building-trust-in-public) and [valuing useful, novel contribution rather than volume](https://solana.com/news/bits-to-bricks-bitrobot-jonathan-victor). These are editorial opportunities inferred from September Solana coverage, not measured viral trends or proof of likely engagement. Do not copy another project's performance/payment claims.

Every post should have one clear point, an accurate source or evidence link where appropriate, and at most one useful invitation. Prefer real screenshots or a short product recording; label devnet, fixtures, planned features and provisional results. No price promises, invented payment testimonials or claims that multiple communities are already live.

X's current [authenticity policy](https://help.x.com/en/rules-and-policies/authenticity) prohibits coordinated engagement exchange and compensated account-metric inflation. Keep the goal useful original contribution; don't make rewards depend on likes, views, repost quotas or mandatory replies. Paying for substance does not by itself establish platform-policy compliance. This guide does not change the approved treasury-funded reward path or certify any future campaign.

## Measure and adjust

For each brief, record unique genuine authors, admitted submissions, counted/scored work, pending or refused entries, duplicate/authorship issues and member support failures. Measure return participation in the next epoch. A member who joined Telegram is not yet an active contributor; a linked wallet is not proof that work was submitted. Keep current read timestamps next to all counts.

Review content weekly: which posts prompted useful questions, voluntary original work and visits to the audit? Use [X's post analytics](https://business.x.com/en/help/campaign-measurement-and-analytics/tweet-activity-dashboard) where available for reach/click context, without claiming access or treating impressions as contribution quality. Increase frequency only if useful outcomes improve and review backlog stays manageable. If people are confused or scoring is pending, fix that before adding posts.

## Current deadlines and next actions

The canonical money/readiness procedure remains [the October 8–9 packet](../demo/2026-10-08-first-payout-readiness.md). No mainnet community/vault or contributor payment is evidenced; the browser observation does not replace the earlier database/operator receipts.

- **Before inviting the cohort:** prove the attended phone signed-link path, retain the settled disjoint Hyphae/Raidar choice, and obtain/verify the genuine registered-group invite, support contact and official publishing account. Recommendation: use the existing registered chat and a disjoint Hyphae paid pilot; no replacement community, fabricated invite or assumed Testers registration. Owner supplies final values and controls future pins/messages.
- **Before wider launch:** release the completed local participant UI under concrete authorization, verify two-way links and current-rule onboarding; prove a second real community's scoping and attended setup independently. Recommendation: keep onboarding operator-assisted until that evidence exists.
- **October 8:** attended C14–C18 remain scheduled; intake pauses at **23:00Z**. Finish real member submissions well before that cutoff. Final C18b author/duplicate audit occurs **after 23:45Z and before October 9 00:00Z**, with required before-close corrections and owner attestation.
- **October 9:** C19–C22 only after **00:00Z**, close/snapshot and hold/safety gates. Claims/payment language follows actual publication and genuine confirmed claim evidence. Empty/no-payable fallback stays explicit.
- **Next work:** inspect the reviewed local T/A/B [candidate/release packet](../superpowers/plans/2026-10-03-participant-onboarding-plan.md#candidate-and-release-packet--october-3). The [owner-doc gate is complete for this scope](../handoffs/2026-10-03-onboarding-scope-packet.md); the approved local T/A/B candidate is complete and locally verified while phone/type/owner links wait. Separately authorize the attended phone test and every live deployment/name/upgrade/placement/menu/pin effect. No deployment or live action follows from local implementation approval. Preserve the frozen runtime boundary for the dated sitting; self-service, multi-chat, new wallet protocols and reward policy remain separate work.

No content, Telegram message, production registration, funding or deployment was performed in preparing this guide.

## October 3 scope checkpoint

Fresh public API read at 21:41:03Z still names Hyphae Lab, epoch 2/intake open, public contribution/count/pending fields 0 and no settlement. Internal row/bot binding/type/webhook/migration health remain UNKNOWN without configured read-only access. Android actual signing remains unexecuted, iOS unknown. Ownership is settled; keep the same registered Lab, no replacement or Testers registration.

The amended packet includes proposed `/start`/`/help` welcome and command controls, public score/payment explanation, exact T/A/B files/tests, sample audit destinations, command-menu scope and pin rollback. The local candidate implements the welcome/help/controls; no live menu/pin/deployment is claimed. Recommend one active disjoint Hyphae paid brief with Raidar separate and hidden pilot until phone PASS; the disjoint/one-active-brief/hidden-until-PASS choices are recorded; genuine Lab invite/support/publishing URLs remain missing.

## Combined release continuation — October4

The [single combined packet](../demo/2026-10-04-combined-release-packet.md) now owns source/artifact/target pins, selected-effect approvals, timestamped technical preflight, phone matrix, private-manifest readiness, Organic consumer requirements and the one bundled input list. Both candidates remain complete at source/checkpoint **e5ee300d6ce65231ec2325fef60be1f1ecbcba05**, local-only. Prior latest gate851/1 skip + Postgres50/50 is prior evidence; no runtime tests/builds ran in this preparation. Current next gate: existing read-only access/genuine URLs and concrete publication/deployment/test/setup scope.

Fresh Oct4 public/API/site reads passed; internal Lab UUID/chat/admin/type/webhook/migration/Fly health remain UNKNOWN. Vercel production target/source is freshly confirmed, and main auto-deploy is enabled: source publication must account for its web deployment. Recommend coupled publication+selected web release and API-only image update with frozen v11 worker retained after preflight. No actual image build, push, deploy or configuration change.
