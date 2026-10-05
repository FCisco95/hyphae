# October 8–9 operator packet

**Current state — October 5, 18:42Z:** the member journey is live on the API machine and the worker stays frozen on `sha256:1c2d6dd5…` through this sitting ([receipts](#live-receipts-october-5-read-only)). Epoch 2 is not empty: a read-only audit found **one counted contribution (66 points) from one member**, who has a signature-linked wallet, a rules-test pass before close and a current balance above the hold threshold; the URL author is the founder's own X account. So the expected path is a payout to one member, the founder ([expected outcome](#expected-epoch-2-outcome-computed-not-a-receipt); [how to say it](#when-the-founder-is-the-only-payable-member)). The empty-epoch fallback below remains the truthful path if any gate fails. [Current handoff](../HANDOFF.md).

Prepared October 2; reconciled October 3 and October 5, 2026. This packet prepares [Runbook C](../handoffs/2026-09-28-runbook-c.md), C14–C22; it executes none of them. Use UTC throughout. The [October 2 readiness receipt](../handoffs/2026-10-02-payout-readiness.md) distinguishes fresh reads from accepted C13 receipts. Recheck every live precondition at the dated, attended sitting. Existing policy, funding and author-attestation rulings remain approved.

## Live receipts, October 5 (read-only)

Read 2026-10-05T18:38Z to 18:42Z from the Windows machine. Nothing was written, sent or deployed. These are the only live claims the three demo documents may make.

| Surface | Receipt |
|---|---|
| Web | `hyphae-delta.vercel.app` serves the production deployment of `main` `56146ba` (GitHub deployment status success 15:28:26Z; CI run 37333057889 success). That commit changes only `docs/`: `git diff 774b97e HEAD -- apps packages pnpm-lock.yaml package.json` is empty, so the web runtime is the source published as `774b97e`. Every docs push redeploys the web with a newer displayed SHA and the same runtime. Home and the epoch 2 page answer 200 |
| API | Machine `6839d31b317318`, `started`, image `sha256:798e18880fd0ce8684c6f4627010e0653ede8a3e3e33584654f6e53cc31ac90c` (built from `774b97e`), updated 2026-10-05T14:26:31Z. `/health`, `/docs` and `/v1/openapi.json` answer 200; the link page serves its copy control. The only error lines in the retained log are the two proxy errors from the ten-second restart gap at 14:26:27Z |
| Migrations | 0013 and 0014 applied 14:25:37Z to 14:25:46Z, journal 13 → 15 rows ([execution record](2026-10-05-api-rollout-plan.md#execution-record-2026-10-05)); none since |
| Worker | Machine `817400c9901de8`, `started`, image `sha256:1c2d6dd52635fc669052dc6b2c40c574af3ecbd0b29b54b99d4002bba4ae70c2` (source `b3c82c7`), updated 2026-10-02T09:19:01Z, unchanged. `reward-recovery` completed every five minutes, latest read 18:40:07Z |
| Epoch 2 | `oct8-audit` at 18:40:31Z (read-only transaction): epoch open to 2026-10-09T00:00Z, intake not paused, 1 admitted contribution (a reply, revision 1, 66 points, accepted 12:03Z today), 0 intakes without a decision, 0 duplicate groups, 1 completed quality dispatch, 0 nominations. Payout gate: blocked solely by `not_final`, as expected before the close |
| Chain, finalized slot 453661976 | Genesis exact. Program `EAz8Wk…4d6E` executable; its ProgramData authority is the Ledger admin `2kz1Zq…fjR`. Community, vault and epoch 2 accounts **absent**. The Ledger admin account does not exist (0 lamports): C14 has not happened. The Treasury fee recipient `rRceAU…u7MK` is System-owned with 895,047,823 lamports |

Not read or not claimed: the program's verifiable-build hash (last receipt is C13 on October 2; the video's `solana-verify` beat re-reads it live), Vercel Pro and usage alerts, Colosseum collaborator access, any real phone, signature or claim.

## Expected epoch 2 outcome (computed, not a receipt)

Computed at 18:40Z by `oct8-audit` from the committed `allocate` code with the audit's own member list, for the pot already approved (gross 500,000,000 lamports):

| Item | Lamports | SOL |
|---|---:|---:|
| Gross pot | 500,000,000 | 0.5 |
| Fee, 3% to the Treasury vault | 15,000,000 | 0.015 |
| Net pot | 485,000,000 | 0.485 |
| Per-wallet cap, 25% of net (fewer than 20 payable) | 121,250,000 | 0.12125 |
| One payable member: allocated | 121,250,000 | 0.12125 |
| Cap remainder, stays in the vault for later epochs | 363,750,000 | 0.36375 |
| Dust | 0 | 0 |

This holds only if the sole member is still payable at the close (signature link in force, 66 points, hold result decided `holder` after the close, author attestation recorded) and no other member is admitted first. A second or later payable member changes every line from the split down; four or more make the cap stop binding. C19's printed numbers replace this table; never quote it as paid.

## When the founder is the only payable member

The only person epoch 2 can pay today is Cisco's own account, through the existing rules: no ruling excludes the founder, so the sitting proceeds as written. The public wording was Cisco's call: **on 2026-10-05, asked to confirm “say it plainly”, Cisco answered “Yes, let's continue”, so the plain wording below stands.** Inviting real members before the close was not authorized by that answer. A payee anyone can look up on-chain would make any vaguer line fail a judge's check.

- **Say, only after C19 to C21 receipts exist:** "The first mainnet payout went to one member: me. One reply of mine, scored 66 by the published rubric, paid to the wallet I signed with. I funded the pot, so no one else's money moved. It shows the whole path working on mainnet: rules, signed wallet, merkle root, claim, receipt. The rest of the pot stays in the vault for later weeks." Replace every figure with C19's printed numbers and the funding line with C18's receipt.
- **Never say:** "contributors were paid", "members" in the plural, a community payout, traction or retention numbers, or that the system verified the post relation or that the account is the member's (it records an attestation by Cisco; oEmbed proves neither).
- **If real members are admitted before the close** (a separate approval: real raid use), recount from the audit and change the wording to match the receipts.
- **If any gate fails or the member is not payable:** use the fallback below ("mainnet program deployed; no contributor payment").

## Sitting timeline (UTC)

Every row's check is a read-back printed or recorded, not a feeling. Anything that fails parks the rows after it.

| When | Step | Who | Closes when |
|---|---|---|---|
| Before October 8 22:00Z | Last docs push to `main`, with Vercel READY verified. **From 22:00Z on October 8 until 00:00Z on October 10 do not push to `main`**: a docs push redeploys the web, and the hold forbids any deployment in that window. Commit locally and record pending SHAs in the handoff; push after October 10 00:00Z | agent | `git status -sb` shows `main` even with `origin/main` |
| Oct 8, an hour before starting | Re-run `oct8-audit` (below) and the live reads in the table above. Confirm attendance, the Ledger and funds: 0.02 SOL for C14 and about 0.5 SOL for C18 plus fees | Cisco, agent | audit prints the same shape; chain accounts still absent |
| Oct 8, attended, finished by about 21:30Z | C14 to C18, in order. Finishing early leaves room for the 22:00Z push of their receipts; if it runs later, the receipts wait for October 10 | Cisco, agent | each step's read-back |
| 23:00Z | C18b: pause intake, read back `reward_intake_paused_at` and public `reward_intake = paused` | Cisco | both read-backs |
| 23:00Z to 23:45Z | Attest authors; run `oct8-audit`; correct any extra original or unconfirmed author | Cisco | audit shows every row resolved |
| 23:45Z to before 00:00Z | Final `oct8-audit`; record the printed audit time, paused state and counts; corrections accepted strictly before 00:00Z (stop starting new ones by 23:55Z) | agent, Cisco | counts recorded, zero unresolved |
| Just after 00:00Z | Resume intake and read back epoch 3 open; verify the close, snapshot and gate per the October 9 table | Cisco, agent | close and snapshot receipts |
| After the gate says `ready`, within the window | C19 to C22; the hold window ends 00:00Z on October 10 inclusive | Cisco, agent | P14 read |

**Audit runner.** From `apps/api` with the variables below, `node --env-file=$hyphaeEnv --import tsx ../../docs/demo/oct8-audit.mts` prints, from one repeatable-read read-only transaction, the C18b inventories (it executes the SQL block in this packet, so they cannot drift), the real payout gate, each member's wallet, rules-test pass and expected allocation, and one finalized balance read for orientation. Rehearsed against production on October 5; it fails closed if the SQL block changes shape. Its output names members and contributions by ID: keep it private and record counts only.

## Onboarding dependency (written October 3, reconciled October 5; no gate/date change)

[Fresh receipt](../handoffs/2026-10-03-onboarding-preparation.md), October 3 18:41Z: live name Hyphae Lab, epoch 2/intake open, rubric 1.2.0, public contributions/counted/pending/leaderboard 0, no settlement; finalized slot 453017150 derived community/vault/epoch accounts absent. DB jobs/schema and program authority/hash below remain prior October 2 receipts, not fresh reads on this Mac. No credentials were provisioned or production state changed.

[Code-path verdict and fifteen-minute test](../superpowers/specs/2026-10-03-link-platform-verdict.md): the signing browser must register Wallet Standard connect/message-signing features. Telegram without them fails; Hyphae's actual Android/Desktop opening behavior and system/wallet browsers are device-unconfirmed. Copy the original private bot URL into the wallet in-app browser, not the stripped address bar. The copy control is live on the API's link page since October 5 (the page serves it); no real phone PASS follows. Recruitment is parked until an owner-attended phone journey succeeds; this test creates link/proof/member records when separately authorized, but sends no work/model call or funds.

The existing MYCEL group stack includes Raidar; [recommend a separate bounded Hyphae paid pilot](../superpowers/specs/2026-10-03-raid-system-decision-memo.md) in the already registered chat. Disjoint Hyphae briefs/Raidar separate, one active brief and hidden pilot until phone PASS are recorded choices; technical registered-chat mapping and genuine invite/support/publishing links remain inputs before activation. No duplicated campaign, changed reward policy, replacement registration or live rename. The [design](../superpowers/specs/2026-10-03-participant-onboarding-design.md) and amended [T/A/B candidate/release packet](../superpowers/plans/2026-10-03-participant-onboarding-plan.md#candidate-and-release-packet--october-3) describe the implementation, now in `main` and live on the API ([receipt](../handoffs/2026-10-03-onboarding-implementation.md)). The [owner research/doc pass is complete for this scope](../handoffs/2026-10-03-onboarding-scope-packet.md); T/A/B scope is complete; recruitment/activation still needs the phone test, owner inputs and separate live authorization. The October 5 rollout checks read the registered row, the bot (administrator in the registered chat, webhook matching, 0 pending, no error) and the migrations as healthy.

**These dependencies do not move the first-payout gates:** real admitted own-account work, signed wallet and 6/6 pass strictly before close; October 8 **23:00Z pause**, final C18b **after 23:45Z** with author attestation and duplicate-original mappings/corrections accepted **before October 9 00:00Z**; then post-00:00Z close/snapshot, hold/safety gates, attended Ledger publication, genuine claim and P14 evidence. Unknown authors/duplicates park C19. An empty/no-payable epoch remains no payment; never seed fake work to meet a date. A signed-message phone test does not prove the later transaction-signing `/claim` path; C21 must evidence the actual claimant's compatible wallet surface at that sitting.

## Canonical addresses and current C15 preflight

| Identity | Address |
|---|---|
| MYCEL mint | `HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg` |
| Program | `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E` |
| Ledger admin/upgrade authority | `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR` |
| Community, derived from program + mint + admin | `HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX` |
| Vault, derived from program + community | `AC3zkGQ9abJs6sssaY5nDX8Qjv2UM19r4JYLgcHoG86K` |
| Epoch 2 account, derived from program + community + index | `J7ipBhK2eJu8QFGtXTsYWNDhPYzcerwX22UkkJTaCPXG` |
| Permanent fee recipient, MYCEL Treasury Squads vault | `rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK` |
| Squads multisig: never use as fee recipient | `34wSn95ZFMsvsq7w6g8Rej7GSagGmpc6Vq5aHiCebu51` |

October 2 17:02Z finalized RPC reads found the derived community, vault and epoch account absent. The fee recipient exists, is System-owned, non-executable and has zero data bytes; the multisig is Squads-owned. The Ledger admin balance was **0 lamports** at 17:04Z. Current rent: community 1,229,360 + vault 695,960 = **1,925,320 lamports**; epoch account, 153 bytes, **1,427,480 lamports**. These are preparation reads, not C14 funding or completed C15. No Ledger connection or Squads Receive-screen comparison was made in this arc. The actual C15 command opens the Ledger to read its address; it signs nothing and writes no database.

## October 8: C14–C18

Confirm attendance and the Ledger before starting. Quit Ledger Live, unlock the device, open the Solana app, and follow the existing blind-signing runbook. Confirm derivation `44'/501'/2'/0'` returns the exact admin above. A prior successful Ledger sitting does not establish availability now.

From the repo root, establish these variables without printing credentials. All following commands run from `apps/api`:

```powershell
$hyphaeEnv = (Resolve-Path .env).Path
$hyphaeMint = 'HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg'
$hyphaeFee = 'rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK'
$hyphaeSigner = "ledger:44'/501'/2'/0'"
$hyphaeRpc = ((Get-Content -LiteralPath $hyphaeEnv | Select-String '^READ_RPC_URL=').Line -split '=', 2)[1].Trim()
Set-Location apps/api
```

Do not paste RPC/token values into saved receipts. Use the mainnet RPC already configured, and require mainnet genesis `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`. The operator scripts enforce the named network and refuse mainnet file signers.

1. **C14:** Cisco transfers the already approved **0.02 SOL** to the Ledger admin for rent/fees only. Read back finalized signature, recipient, amount and admin balance. This is separate from deployment funding and the pot. Never fund either retired temporary key in [WALLETS](../WALLETS.md).
2. **C15, read only:**

   ```powershell
   node --import tsx scripts/init-community.ts plan --mint $hyphaeMint --fee-recipient $hyphaeFee --network mainnet --rpc $hyphaeRpc --signer $hyphaeSigner --gross 500000000
   ```

   Require the exact program/admin/mint/community/vault/recipient above. Cisco compares the recipient with **MYCEL Treasury → Receive** in Squads. Absence or a different owner/recipient stops initialization. If already initialized, inspect the program-owned account and decoded mint/admin/recipient; an unexpected community parks dependent work. The community and fee recipient are immutable, and neither community nor vault has a close/withdraw instruction.
3. **C16:** only after C15 and the owner comparison, use the same command with `send`. Simulation must succeed before one Ledger approval. Save `initialized: <signature>` and the decoded mint/admin/fee recipient. If already initialized with matching values, the script sends nothing. On uncertain send, read the derived account first; never create a replacement identity.
4. **C17:** Cisco runs the printed conditional statement. For these derivations it is:

   ```sql
   update communities
   set chain_address = 'HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX'
   where mint = 'HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg'
     and chain_address is null;
   ```

   Require one updated row, or prove an existing identical binding; never overwrite a mismatch. A read-only select must match the initialized chain account. The runbook allows clearing the binding before publication; that is a separately attended production write, not an undo of the immutable chain community.
5. **C18:** rerun C15 immediately before giving Cisco an amount. For gross **G = 500,000,000 lamports**, vault balance **B**, rent **R** and allocated/unclaimed outstanding **O**, the existing `vaultTopUp` implements **T = max(0, G − (B − R − O))**. Reserved rent and outstanding allocations never fund this epoch. Unexpected insolvency or account data stops the step. After a clean new initialization, B = R and O = 0, so T would be 500,000,000 lamports (**0.5 SOL**); this is conditional, not a transfer instruction based on today's absent vault. Cisco sends the freshly calculated **exact T directly to the vault**, checks its address on the funding wallet screen and records the signature. A rerun must say the gross pot is covered. If T = 0, send nothing. There is no withdrawal rollback; surplus stays for later epochs. Do not deduct the 3% fee before funding the gross pot.

`init-community plan` is a chain read. `init-community send`, C17, pause/resume and correction are production mutations. **`publish-epoch plan` is also a production write**: it backfills commitments and stores exact publication bytes. There is no publish dry-run flag to use during preparation. Reuse the accepted devnet receipts and local refusal tests instead of executing it early.

## C18b: frozen inventory and corrections

The October 2 inventory is provisional: 0 admitted epoch-2 contributions and 0 duplicate groups. Intake remains open. It proves no author attestation or final audit; scoring can continue after the pause, so decision revisions must still be refreshed.

On **October 8 from 23:00Z**, Cisco pauses intake:

```powershell
node --env-file=$hyphaeEnv --import tsx scripts/reward-intake.ts $hyphaeMint pause
```

Record the printed pause timestamp; read back `reward_intake_paused_at` and public `reward_intake = paused`. Admission and re-entry must refuse while paused; epochs keep their schedule. Do not stop the worker. Run the following two inventories together in one **repeatable-read, read-only** transaction; the [audit runner](#sitting-timeline-utc) executes exactly this SQL block and adds the gate and allocation read-outs. Retain only the IDs needed to resolve the audit, URL author, revisions and correction references; omit Telegram IDs/usernames, member text and model input/output. An operator may keep row-level attestation evidence privately; public receipts need counts and the verdict, not identities.

```sql
begin transaction isolation level repeatable read read only;
set local statement_timeout = '20s';
select clock_timestamp() as audit_at,
       current_setting('transaction_read_only') as read_only;

-- Every admitted epoch-2 contribution, including pending and zero-point work.
select i.id as intake_id, i.contribution_id, i.member_id, i.task_id,
       c.kind, c.url,
       substring(c.url from '(?:x|twitter)\.com/([A-Za-z0-9_]+)/status/') as url_author,
       coalesce(i.reentry_of, i.id) as original_id,
       d.revision, d.credited_quality, d.point_units,
       d.accepted_at, d.affects_allocation
from reward_intakes i
join communities cm on cm.id = i.community_id
join epochs e on e.id = i.epoch_id
join contributions c on c.id = i.contribution_id
left join lateral (
  select revision, credited_quality, point_units, accepted_at, affects_allocation
  from reward_decisions where contribution_id = i.contribution_id
  order by revision desc limit 1
) d on true
where cm.mint = 'HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg'
  and e.index = 2
order by i.member_id, i.id;

-- Include original raid intakes from earlier epochs and their re-entries.
with all_raid as (
  select i.id, i.member_id, i.task_id, c.kind,
         coalesce(i.reentry_of, i.id) as original_id, e.index
  from reward_intakes i
  join communities cm on cm.id = i.community_id
  join epochs e on e.id = i.epoch_id
  join contributions c on c.id = i.contribution_id
  join tasks t on t.id = i.task_id
  where cm.mint = 'HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg'
    and t.kind = 'raid'
)
select member_id, task_id, kind,
       count(distinct original_id) as distinct_originals,
       array_agg(distinct original_id) as original_ids,
       array_agg(id) as intake_ids
from all_raid
group by member_id, task_id, kind
having count(distinct original_id) > 1 and bool_or(index = 2);
commit;
```

Cisco attests that every listed X author is that member's own account. First-submit handle binding is not ownership proof. Missing/unparseable author evidence is unresolved, never auto-approved. Identify each extra distinct original in a duplicate group and every unconfirmed author, map it to its **epoch-2 contribution**, and zero it under the existing ruling. Re-entries of one original do not themselves create a duplicate. A group remains visible after correction because intakes are immutable: reconcile it to zero-point successor decisions, rather than expecting the duplicate query to become empty.

Correction template, only with Cisco attending and confirming the concrete row/reason/evidence:

```powershell
node --env-file=$hyphaeEnv --import tsx scripts/reward-correct.ts <contribution-id> --expected-revision <latest-n> --reason '<public audit reason>' --evidence '<audit reference>' --raw-quality 0
```

Require `affects allocation: true`, zero credited quality/point units, and database `accepted_at` **strictly before October 9 00:00Z**. A correction at exactly close is too late. On stale revision, read the successor and review before rerunning; replaying the identical command is idempotent. No-decision work refuses correction; leave it open, let the existing worker score, and revisit it. Do not manufacture a decision, force a paid evaluation, or type points directly.

**After October 8 23:45Z and before October 9 00:00Z**, rerun both inventories, pending-decision/dispatch/nomination counts and all correction read-backs. Record audit time, paused state, total rows, distinct originals/groups, author-confirmed and zeroed counts, selected revisions, zero-point corrections with `affectsAllocation = true`, and **zero unresolved items**. The owner attestation and mapping of every duplicate group to retained/zeroed originals must be recorded. Work still unsettled at close parks Part 4 before C19; a borrowed post or extra duplicate discovered after close also parks it, because later corrections cannot change the frozen allocation.

Just after **October 9 00:00Z**, Cisco resumes intake and records `reward intake resumed`; read back open intake for epoch 3. Do not reopen epoch 2.

## October 9: C19–C22 acceptance packet

Before C19, require the recorded clean/fully corrected C18b audit and renewed attendance. Recheck machines/image, schema/pinned config, mainnet program/hash/Ledger authority, community binding/permanent recipient and funded capacity. Unexpected schema/program/worker state parks dependent steps; do not repair production in a readiness session.

| Gate | Required evidence |
|---|---|
| Close | Database clock after **October 9 00:00Z**, epoch 2 closed, exactly one immutable snapshot at scheduled cutoff, entries/totals matching effective pre-close decisions; epoch 3 open. Save close timestamp and completed `reward-close`, with no unexplained failed/backlogged jobs. |
| Eligibility | Positive point units; the wallet verified by signature at close; a **6/6 rules-test pass strictly before close** for pinned MYCEL 1.2.0; no duplicate payable wallet. SDK remains exactly 0.1.0 through October 12. No rules/Jev merge into this sitting. |
| Hold | Pinned threshold **100,000,000,000 raw MYCEL units**. A decided holder/below result for the exact wallet, mint and threshold, observed from close through **October 10 00:00Z inclusive** (the 24-hour gate window), with provider/slot/time/amount recorded. Unknown, late or mismatched evidence cannot establish eligibility. Wait for required hold checks; never override blockers. |
| Payout gate | Read-only `evaluatePayoutGate` returns `ready`; record member verdicts and every blocker if it does not. `no_payable_members` means no publication or claim. A funded vault or a deployed program proves neither eligibility nor payment. |
| C19 intent | The command below stores production intent; check gross **500,000,000**, fee **15,000,000** (300 bps) to the exact Treasury vault, allocated total, cap remainder, every leaf wallet/amount, root and audit hash. Save immutable manifest bytes/hashes and pinned config evidence. |
| C20 publication | Matching stored intent, simulation before one Ledger approval, actual confirmed publish signature, decoded on-chain root/audit hash/gross/allocated totals and fee recipient. No rollback of the root. A send/record crash recovers from the same stored bytes and matching on-chain epoch; a mismatch stops recovery. Never override `already_published` to send again. |
| C21 claim | A genuinely payable tester uses `/claim` with the wallet whose signed link counted at close and about **0.002 SOL of their own** for fees/receipt rent. Save claim signature and matching receipt; mark paid only with chain evidence. No synthetic mainnet leaf or stand-in participant. |
| C22 / P14 | Epoch API: `settlement.allocation = published`, `publish_tx` equals C20. `settlement.payment = available`; claimed tester is `paid` with C21's `claim_tx`, other payable members are `claimable`. Wallet claims and the site agree. **Claimed + unclaimed = allocated**; fee and cap remainder equal C19. Root/manifest/receipt evidence supports every status. |

From `apps/api`, at C19 only:

```powershell
node --env-file=$hyphaeEnv --import tsx scripts/publish-epoch.ts plan --mint $hyphaeMint --epoch 2 --gross 500000000 --network mainnet --rpc $hyphaeRpc --signer $hyphaeSigner
```

At C20 use the same command with `publish`, after reviewing C19. C22 reads:

```text
GET https://hyphae-api.fly.dev/v1/communities/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/epochs/2
GET https://hyphae-api.fly.dev/v1/wallets/<tester-wallet>/claims
GET https://hyphae-api.fly.dev/v1/communities/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/epochs/2/claims/<tester-wallet>
https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2
```

## Evidence still needed and truthful fallbacks

| Owner action | Recommendation and reason |
|---|---|
| Real uptake, wallet/rules prerequisites | After the attended phone path and founder raid choice are verified, Cisco brings real own-account work through the existing registered raid/submit flow, with signed `/link` and rules pass before close, leaving time for scoring and attestation. On October 5 epoch 2 holds one counted contribution from one member (the founder's own account), already satisfying the signed-wallet and rules-pass prerequisites; more real own-account work before the close needs its own approval. No agent community message or scoring experiment was sent. |
| October 8–9 attendance and Ledger | Reserve C14–C18, 23:00Z pause and the 23:45Z audit, then post-close publication/claim time; check the exact Ledger derivation live before any irreversible action. Availability remains unverified today. |
| Squads Receive screen and funding wallet | Compare the fixed Treasury vault at C15 and the exact transfer destination at C18; current RPC ownership is necessary but does not replace Cisco's dashboard comparison. The already approved amounts/source need no new funding decision. |
| Vercel Pro and usage alerts | Confirm the previously approved Pro upgrade/alerts in the dashboard before C20 earns a fee; completion is not evidenced in this arc. |
| Reviewer access/video/submission | Confirm Colosseum collaborator access, record under three minutes October 9, submit October 10. Use the working Vercel alias until a custom domain is evidenced; do not wait on the unresolved domain. |

If epoch 2 remains empty or has no payable members, preserve the actual gate refusal and `no_settlement` surfaces. Wallet claims may correctly be 200/empty; a missing leaf is 404 `not_found`, including `/api/claims/<mint>/2/<wallet>` with `cache-control: no-store`. Neither response proves service failure or payment. An RPC/chain-read failure means payment unavailable with its actual reason; never translate it to paid/claimable. Record “mainnet program deployed; no contributor payment,” retain the labeled devnet proof for the video, and omit mainnet payout swap-ins without C20/C21/C22 receipts. Fixture screenshots remain fixtures. See the [video script](2026-10-09-final-video.md) and [submission checklist](2026-10-10-submission-checklist.md).

## Release history (October 4 to 5)

The [combined release packet](2026-10-04-combined-release-packet.md) held the source, artifact and target pins. Its two effects have since run: source `774b97e` was published to GitHub and the web redeployed from it (October 5), then the API-only rollout moved only machine `6839d31b317318` to image `sha256:798e1888…` with migrations 0013+0014 ([execution record](2026-10-05-api-rollout-plan.md#execution-record-2026-10-05)). The worker never moved. See [live receipts](#live-receipts-october-5-read-only) for the current state; earlier statements in that packet that call the source local-only or unreleased are superseded.

C1–C13 remain complete; C14–C22 unexecuted. Reserve the original attended dates and preconditions, the 23:00Z pause, final C18b after 23:45Z and corrections/attestation strictly before October 9 00:00Z; only after close and gate readiness can publication, the actual claim and P14 follow. The hold observation window runs through October 10 00:00Z inclusive. Empty or no-payable remains no payment.
