# October 8–9 operator packet

Prepared October 2; reconciled October 3, 2026. This packet prepares [Runbook C](../handoffs/2026-09-28-runbook-c.md), C14–C22; it executes none of them. Use UTC throughout. The [October 2 readiness receipt](../handoffs/2026-10-02-payout-readiness.md) distinguishes fresh reads from accepted C13 receipts. Recheck every live precondition at the dated, attended sitting. Existing policy, funding and author-attestation rulings remain approved.

## October 3 onboarding dependency (no gate/date change)

[Fresh receipt](../handoffs/2026-10-03-onboarding-preparation.md), October 3 18:41Z: live name Hyphae Lab, epoch 2/intake open, rubric 1.2.0, public contributions/counted/pending/leaderboard 0, no settlement; finalized slot 453017150 derived community/vault/epoch accounts absent. DB jobs/schema and program authority/hash below remain prior October 2 receipts, not fresh reads on this Mac. No credentials were provisioned or production state changed.

[Code-path verdict and fifteen-minute test](../superpowers/specs/2026-10-03-link-platform-verdict.md): the signing browser must register Wallet Standard connect/message-signing features. Telegram without them fails; Hyphae's actual Android/Desktop opening behavior and system/wallet browsers are device-unconfirmed. Copy the original private bot URL into the wallet in-app browser, not the stripped address bar. The proposed page copy control is not implemented. Recruitment is parked until an owner-attended phone journey succeeds; this test creates link/proof/member records when separately authorized, but sends no work/model call or funds.

The existing MYCEL group stack includes Raidar; [recommend a separate bounded Hyphae paid pilot](../superpowers/specs/2026-10-03-raid-system-decision-memo.md) in the already registered chat. Founder raid choice, registered-chat mapping, genuine invite/support/publishing links remain inputs before activation. No duplicated campaign, changed reward policy, replacement registration or live rename. The [design](../superpowers/specs/2026-10-03-participant-onboarding-design.md) and amended [T/A/B candidate/release packet](../superpowers/plans/2026-10-03-participant-onboarding-plan.md#candidate-and-release-packet--october-3-awaiting-approval) are documentation only. The [owner research/doc pass is complete for this scope](../handoffs/2026-10-03-onboarding-scope-packet.md); generic T/A local work waits only for explicit build scope, while recruitment/activation still needs phone/type/owner inputs and separate live authorization. Current registered row/bot binding/type/migration health are UNKNOWN without access; no deployment failure is inferred.

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

Record the printed pause timestamp; read back `reward_intake_paused_at` and public `reward_intake = paused`. Admission and re-entry must refuse while paused; epochs keep their schedule. Do not stop the worker. Run the following two inventories together in one **repeatable-read, read-only** transaction. Retain only the IDs needed to resolve the audit, URL author, revisions and correction references; omit Telegram IDs/usernames, member text and model input/output. An operator may keep row-level attestation evidence privately; public receipts need counts and the verdict, not identities.

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
| Real uptake, wallet/rules prerequisites | After the attended phone path and founder raid choice are verified, Cisco brings real own-account work through the existing registered raid/submit flow, with signed `/link` and rules pass before close, leaving time for scoring and attestation. October 3 public reads show no epoch-2 entries to pay. No agent community message or scoring experiment was sent. |
| October 8–9 attendance and Ledger | Reserve C14–C18, 23:00Z pause and the 23:45Z audit, then post-close publication/claim time; check the exact Ledger derivation live before any irreversible action. Availability remains unverified today. |
| Squads Receive screen and funding wallet | Compare the fixed Treasury vault at C15 and the exact transfer destination at C18; current RPC ownership is necessary but does not replace Cisco's dashboard comparison. The already approved amounts/source need no new funding decision. |
| Vercel Pro and usage alerts | Confirm the previously approved Pro upgrade/alerts in the dashboard before C20 earns a fee; completion is not evidenced in this arc. |
| Reviewer access/video/submission | Confirm Colosseum collaborator access, record under three minutes October 9, submit October 10. Use the working Vercel alias until a custom domain is evidenced; do not wait on the unresolved domain. |

If epoch 2 remains empty or has no payable members, preserve the actual gate refusal and `no_settlement` surfaces. Wallet claims may correctly be 200/empty; a missing leaf is 404 `not_found`, including `/api/claims/<mint>/2/<wallet>` with `cache-control: no-store`. Neither response proves service failure or payment. An RPC/chain-read failure means payment unavailable with its actual reason; never translate it to paid/claimable. Record “mainnet program deployed; no contributor payment,” retain the labeled devnet proof for the video, and omit mainnet payout swap-ins without C20/C21/C22 receipts. Fixture screenshots remain fixtures. See the [video script](2026-10-09-final-video.md) and [submission checklist](2026-10-10-submission-checklist.md).
