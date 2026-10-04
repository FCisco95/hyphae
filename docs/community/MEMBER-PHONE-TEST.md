# First-time member phone journey

**Local fixture coverage only. The attended phone test has not run.** The private-alert production approval is still pending, and these member-journey changes require a new reviewed release scope. Do not publish changed code under the old candidate approval.

The acceptance story is: a designated community admin chooses one target; a member opts into private alerts, receives the exact raid, submits their own reply or quote, and can explain their receipt and report a problem. Community-specific steward roles remain unavailable until Organic supplies the authoritative role and Telegram identity contract. Telegram group administration alone does not grant that authority.

## Local fixture rehearsal

Run from the Hyphae repository. These suites use disposable local databases, fixture users and intercepted Telegram transport. They do not send Telegram messages, sign with a real wallet, make paid model calls or submit transactions.

```sh
pnpm --filter @hyphae/api exec vitest run src/bot/commands/member-phone.test.ts src/bot/commands/effort.test.ts src/bot/commands/onboarding.test.ts src/bot/commands/link.test.ts src/bot/commands/rules.test.ts src/bot/commands/notifications.test.ts src/raid-alerts/alerts.test.ts src/member-journey/submissions.test.ts src/member-journey/receipts.test.ts src/bot/commands/receipts.test.ts src/member-journey/lifecycle.test.ts src/bot/commands/raid-lifecycle.test.ts
```

| Journey step | Fixture assertion | Evidence boundary |
| --- | --- | --- |
| Join the intended community | Registered group resolves the correct community. Unregistered and private welcome/help never guess one. | Simulated membership does not prove a real invitation or successful join. |
| Link a wallet | Group command opens the caller's private flow. Link payloads and membership checks reject other-community or malformed requests. | These command fixtures do not establish phone wallet-browser compatibility or an attended signature. |
| Read and pass rules | The private test uses the current pinned rubric, requires all answers, and rejects outsiders, stale callbacks and another community's quiz. | A fixture pass is not a participant's live pass. |
| Choose private alerts | Opening Start offers consent; only Enable saves it after exact-group membership verification. Stop applies to the selected community. | No live subscription is created. |
| Receive the correct raid | Message contains community, exact target, brief and UTC window. Stale consent, departed members and terminal/expired raids cannot produce a new dispatch. Unknown sends stay uncertain. | Intercepted transport cannot prove delivery to a phone. |
| Submit a reply or quote | A prompt binds caller, community, raid and kind. A foreign session, revoked membership, unavailable evidence, expired window or closed task gives a refusal without false success. | Submitted X authorship and target engagement remain unverified when the evidence source cannot prove them. |
| Cancel or retry submission | Cancelling a prompt prevents fresh intake. Duplicate receipt retries retain the original submission. Failed queue dispatch remains visible and may be retried without another contribution. | Cancelling a prompt does not withdraw received work. |
| Understand the result | Receipt identifies the original work, pending/scored state, counted/excluded reason and audit. Provisional points are distinct from eligibility, allocation, claimability and payment. | Fixture scores and allocation records are not earned credit or confirmed payment. |
| Report a scoring problem | `/issue <receipt ID> <explanation>` is caller-scoped, deduplicated and append-only. Existing scores and frozen decisions remain unchanged. | Recording an issue does not promise a correction or review deadline. |
| Close or cancel the raid | Only the current designated admin in the registered group can act. The action requires a reason and creates a durable receipt. Duplicate actions reuse it. History survives. Historical open briefs use the same controls, so the one-active-brief gate can be cleared without bypassing it. | Cancellation stops future intake. Retroactively changing earned credit or allocation needs a founder decision. |

`member-phone.test.ts` drives the actual bot and notifier with intercepted Telegram calls: welcome/link/rules entrypoints → explicit alerts consent → designated-admin raid → private reply/quote buttons → forced reply → saved receipt → duplicate retry → refresh → issue → closure. Separate cases exercise prompt cancellation, the explicit-session command fallback, failed queue dispatch and retry, copied identities, membership loss, expiry, unavailable evidence and raid cancellation. Its member wallet is prelinked fixture data; the existing link/rules suites cover their own boundaries.

The reward-lane case follows a private submission through the unchanged `runEvaluation` with a fixture provider, actual `/effort <already-submitted URL>` nomination, a fixture effort upgrade, and the public contribution parser used by the web app and read client. Verification remains separately unverified in the private receipt; the captured evidence retains the existing `text_only` limitation. These fixture points are not a real member's earned credit. `effort.test.ts` also refuses a new URL even when multiple historical active tasks exist, and proves standalone text remains separate.

Local test results and commit identifiers belong in `docs/HANDOFF.md` and the build log. Record a failed or skipped assertion as such; do not turn this checklist into an attended-test receipt.

## Attended test, after its separate authorization

Use a fresh member account in the registered test community. Record phone OS, Telegram version, wallet/browser version, release commit and timestamp. Use a separately authorized test wallet; leave any payment or claim transaction out of this journey. The owner must supply the real, verified invite and confirm that the target and brief are the intended ones. Do not invent an invite or ask the member to forward a private wallet-link URL.

1. **Join and orient.** Join through the owner's verified invite. Open `/start`, `/help brief` and `/help`. The member should identify the community, selected target, closing time and public audit destination. With no active raid, expect an explicit empty state.
2. **Link with cancellation.** Tap `/link` in the group, open the official bot and use the original private link. In the compatible wallet browser, cancel the first signature request. Confirm `/me` does not claim a completed link. Start again and sign only the separately authorized readable linking message. Confirm the linked wallet in the member's own `/me`. A transfer, token approval or seed-phrase request is a failed test.
3. **Rules and retry.** Read the community's pinned rules, answer one question incorrectly and finish. Confirm there is no pass. Retry, answer all correctly, and confirm only that community/current epoch receives the pass. The member should explain why a rules pass alone does not mean payment.
4. **Private consent.** From `/notifications`, open the bot's Start offer. Confirm no subscription until Enable. Enable the named community and verify the confirmation. Stop and re-enable once; previously opened raids must not be replayed.
5. **Authorized target.** The designated admin opens a bounded raid. Confirm the member receives its community, target, brief, UTC window and **Submit my reply / Submit my quote** buttons. Attempting a second active raid must identify the existing raid. A non-designated Telegram admin must not gain raid authority.
6. **Prompt cancellation and exact target.** Tap **Submit my reply**, read the exact target, then run the shown `/cancel_submission <session ID>`. Attempt the old prompt once: it must refuse new work. Tap the original raid button again. Confirm the new prompt still refers to that raid even if another community has a newer raid.
7. **Submission and duplicate retry.** Reply to the prompt with the URL of the member's own work. Confirm a durable receipt or a clear refusal; no generic success after evidence, membership or queue failure. Repeat the same request. Confirm the same receipt, one contribution and no second credit. If phone reply mode is lost, use the exact `/submit <session ID> <URL>` fallback shown by that prompt.
8. **Quote and source limits.** Submit the member's own quote through the separate quote button. The receipt must distinguish the declared relationship to the target from account ownership. Ask the member what remains unverified. A first-seen handle or model assessment must not be described as ownership proof. Keep the current payout's approved human attestation intact.
9. **Read, nominate and dispute.** Use **Refresh receipt** or `/receipt <receipt ID>`. Have the member identify whether work is received/pending/scored, whether it is counted/excluded and why, and whether the number is provisional points or an allocation. If effort nomination is part of the authorized test, use `/effort <already-submitted URL>` in the group after scoring; it must retain the original submission and raid. A new URL must direct the member to the exact raid's private button, while `/effort <text of separate work>` remains standalone. Submit one `/issue <receipt ID> <explanation>` and retry the same update. Expect one issue tied to the original receipt and no automatic score/frozen-decision change.
10. **Terminal states and retention.** The admin uses `/close_raid <raid ID> <reason>` on one test raid and `/cancel_raid <raid ID> <reason>` on another. The member's old buttons must refuse new submissions, while old receipts and issue reporting remain available. Repeated admin requests return the original action receipt. Test natural expiry on a bounded raid separately. Closing/cancelling never reports that funds were paid or previous credit was removed.
11. **Membership loss and failures.** With the owner attending, test the bounded membership-removal case and retry a retained prompt. New intake must stop. A simulated/local queue outage should show saved-but-not-confirmed-as-queued; a local uncertain-delivery fixture must not be blindly resent. Do not create production outages to exercise these states.

Pass only when the member can state, in their own words: “This receipt is for my submission to this community's exact raid. These points are provisional until the recorded process decides otherwise. An allocation is not a payment. This evidence does not by itself prove I own the X account. I know how to report a scoring problem.” Record where they needed help.

## Record after attendance

- Result: **not run / pass / fail / blocked**; timestamp and release commit.
- Device and app versions; which separately authorized live actions occurred.
- Redacted raid/submission/issue receipt IDs and observed result for each step. Never store wallet-link fragments, credentials or private Telegram content in this public-safe record.
- Any mismatch, retry, cancellation, unreadable message, or uncertainty that prevented understanding.
- Explicitly separate confirmed link/rules/receipt evidence from any later payout attestation, claim transaction or confirmed payment. Claims need their own authorization and evidence.
