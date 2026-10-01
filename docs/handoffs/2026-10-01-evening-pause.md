---
date: 2026-10-01
summary: Pause at 2026-10-01 20:45Z, mid-arc, at Cisco's request to decide between continuing and syncing; the recommendation was to sync and resume at the gate. Done and pushed today - the Ledger devnet rehearsal and browser claim, Runbook C C1 and C2, C8's mainnet read, a scaffold removal. Not started - the epoch 1 close proof, C3 to C7, C8 to C13. Nothing in production, Neon (writes), Fly, Vercel or mainnet changed.
---

# 2026-10-01 evening pause (for /organic-sync)

Runner: Claude Code **Sonnet 5.5** (`claude-sonnet-5-5`), effort **high**, no helpers, no subagents. Usage was not exposed by the runtime. Paid provider calls: none. On-chain spend: devnet only (about 1.17 SOL of rent in the throwaway program, still held).

## Commits and merge disposition

| SHA | What | State |
|---|---|---|
| `187d165` | Rehearsal receipt, BUILDLOG, handoff | Pushed to `origin/main` |
| `e31c4c4` | Remove Anchor's empty `migrations/deploy.ts`; C1 and C2 recorded | Pushed to `origin/main` |
| this pause commit | HANDOFF refresh and this snapshot | Pushed with it |

Branches unchanged: `feat/jev-eval` `707d7da`, `feat/rules-v2` `158452f`, `fix/timing-budgets` `02ee74e` (merge after C7), `docs/runbook-c-truths` `b95d0ab` (`ad40b77` after C7, `b95d0ab` after C13). `main`'s API tree equals `b3c82c7` (checked: no diff under `apps packages programs` and the root build files).

## Stage of the production path

Production `86ff258`, Neon 0000 to 0009, `first_paid_epoch` 2, candidate `b3c82c7`. Program: devnet `EAz8WkyU…` only; mainnet `AccountNotFound` (read 2026-10-01, public RPC). The Ledger address `2kz1Zq…` holds 0 SOL on mainnet.

## Attended receipts (devnet only)

See [the rehearsal receipt](2026-10-01-ledger-devnet-rehearsal.md): Ledger address read, buffer hash check, one blind Ledger approval for the deploy of throwaway `GWBJHTQM…cpTY` (signature `2wBkWB9a…ETV3`), chain readback (authority `2kz1Zq…`, hash `7e902d1b…43ac`), and a Phantom claim `4eqG2A4X…7Mn6` on devnet. No mainnet receipt exists.

## Checks run

- C1 on `b3c82c7`: test, typecheck, lint, `drizzle-kit check`, `test:pg`, `git diff --check` all exit 0.
- C2 on Neon: journal 0000 to 0009 with matching hashes; 0010 to 0012 absent; `reward_intakes` 0, `reward_decisions` 0, `leaves` 0; no transaction older than 5 s.
- Gate on the docs commits: `pnpm lint` and `pnpm typecheck` exit 0.
- `jscpd` over `apps` and `packages` (non-test): one clone, 0.33% of lines (two intentionally identical test-vector JSON files). `knip` finds no unused production code beyond test-only exports; two dependency cleanups below.

## What to do next

1. **After 2026-10-02T00:00Z, read-only, the agent alone:** run the epoch 1 proof below. Expected: epoch 1 `closed` with one snapshot (zero entries, since nobody has submitted), epoch 2 open (closes 2026-10-09T00:00Z), a completed `reward-close` job and none failed, and epoch 1's gate `blocked` with `before_first_paid_epoch` among its blockers. At 20:31Z today it read epoch 1 `open`, no snapshot, gate `not_final`, `reward-recovery` 2,055 completed and 0 failed. **Any other result stops Part B: report, don't repair.**
2. **With Cisco, one step per message:** C3 to C7 (C1 and C2 passed; rerun C2's activity check at C4). Then C8 to C13: C8's mainnet read passed today; `READ_RPC_URL` is not in `.env` until C6, so C8 and C10 reads can use the public RPC or the C6 value. Recommended: do C8 to C13 in the same sitting, with a clear head, because C10 sends 1.2 SOL and C12 is a blind Ledger approval.
3. After C7: integrate `ad40b77` and `fix/timing-budgets` (rebase, fast-forward), full gate, push. After C13: `b95d0ab`, and delete only the fully integrated branches.
4. **Queued cleanups after C7** (they touch the pinned tree, so not before): drop the unused root dependency `@anchor-lang/core`; move `zod` in `apps/web/package.json` to devDependencies if only `api.test.ts` uses it. Both are `package.json` changes: do them as one commit, with the full gate.

## Parked, with recommendations

1. **Optional close of the throwaway devnet program `GWBJ…` with the Ledger** (one approval, returns 1.1663934 devnet SOL, rehearses C11's rollback). Recommend yes, low priority.
2. **Zero submissions so far.** The first payout needs real contributions in epoch 2 (Oct 2 to 9), and Cisco's own community activity is what produces them. Recommend Cisco asks MYCEL members to submit through the bot as soon as Runbook C's C7 is live; the agent can draft the call, Cisco posts it.
3. Everything in [the session close](2026-09-30-session-close.md), "Parked": Jev calibration, the project brief's two questions, a second labeler, quoted-post intake, the `gates.pg.test.ts` hang, Vercel Pro and alerts, `hackathon@colosseum.com` repo access, the domain, database cost after Oct 12.

## The epoch 1 proof script

Run from `apps/api` of a worktree at `b3c82c7` with `pnpm install --frozen-lockfile`, saved as `scripts/epoch-proof.ts` there (never commit it: the API tree must stay the candidate). Set `HYPHAE_ENV_FILE` to the repo's `.env`, then `node --import tsx scripts/epoch-proof.ts`. It is read-only: one `BEGIN READ ONLY` transaction plus `evaluatePayoutGate`, which is itself read-only. A local worktree `../hyphae-wt/c1-gate` already holds it and the install (not portable; recreate it on another machine, and note that its copy reads the `.env` path hard-coded for this machine).

```ts
import { readFileSync } from "node:fs";
import { communities, createDb, epochs, rewardEpochSnapshots, rewardSnapshotEntries } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { evaluatePayoutGate } from "../src/payout/gate.js";
import { readOnly } from "../src/pg.js";

const MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
const env = readFileSync(process.env.HYPHAE_ENV_FILE ?? "", "utf8").replace(/^﻿/, "");
const url = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))?.split("=").slice(1).join("=").trim();
if (!url) throw new Error("DATABASE_URL not in .env");
const db = createDb(url);

const out = await readOnly(db, async (tx) => {
  const [community] = await tx.select().from(communities).where(eq(communities.mint, MINT));
  if (!community) throw new Error("community not found");
  const eps = await tx.select().from(epochs).where(eq(epochs.communityId, community.id)).orderBy(epochs.index);
  const snapshots = await tx
    .select({ epochId: rewardEpochSnapshots.epochId, id: rewardEpochSnapshots.id, closesAt: rewardEpochSnapshots.closesAt, closedAt: rewardEpochSnapshots.closedAt })
    .from(rewardEpochSnapshots)
    .where(eq(rewardEpochSnapshots.communityId, community.id));
  const entries: Record<string, number> = {};
  for (const s of snapshots) {
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(rewardSnapshotEntries).where(eq(rewardSnapshotEntries.snapshotId, s.id));
    entries[s.id] = n;
  }
  const jobs = await tx.execute(sql`
    select name, state, count(*)::int as n, min(created_on) as first, max(completed_on) as last_done
    from pgboss.job where name in ('reward-close', 'reward-recovery', 'hold-check') group by name, state order by name, state`);
  const failed = await tx.execute(sql`
    select name, created_on, left(coalesce(output::text, ''), 300) as output
    from pgboss.job where state = 'failed' and name like 'reward-%' order by created_on desc limit 3`);
  return { community, eps, snapshots, entries, jobs: [...jobs], failed: [...failed] };
});

const gates = [];
for (const e of out.eps) {
  const g = await evaluatePayoutGate(db, { communityId: out.community.id, epochId: e.id });
  gates.push({ epoch: e.index, status: g.status, blockers: g.status === "blocked" ? g.blockers : [] });
}

console.log(
  JSON.stringify(
    {
      now: new Date().toISOString(),
      firstPaidEpoch: out.community.firstPaidEpoch,
      epochs: out.eps.map((e) => ({ index: e.index, status: e.status, opensAt: e.opensAt, closesAt: e.closesAt, hasRewardConfig: !!e.rewardConfigId })),
      snapshots: out.snapshots.map((s) => ({ epochId: s.epochId, closesAt: s.closesAt, closedAt: s.closedAt, entries: out.entries[s.id] })),
      jobs: out.jobs,
      failedRewardJobs: out.failed,
      gates,
    },
    null,
    1,
  ),
);
await db.$client.end();
```

## Local environment notes

- This machine's clock reads one hour ahead of UTC (local 21:31 was 20:31Z); use `date -u`.
- Windows CLI path `%USERPROFILE%\solana-3.1.10\solana-release\bin`; Ledger URL `usb://ledger?key=2/0`; WSL scripts per the memory note on the WSL pattern. Today's verifiable build is at WSL `~/vb/oct2/target/verifiable/hyphae.so` (sha256 `cb4ffdd8…8d79`), a fresh clone at `b3c82c7`; C9 may reuse it only if the sha256 and the `solana-verify` hash are checked again.
- The devnet hot key `Fcv1xt…` (`~/hyphae-devnet/admin-2026-09-25.json` in WSL) is the shared devnet admin; do not delete it.
- `git worktree list` shows `hyphae-wt/c1-gate` (detached at `b3c82c7`) for the proof and C1; remove it with PowerShell `Remove-Item -LiteralPath` on the `\\?\`-prefixed path, then `git worktree prune`.

## Suggested skills for the next session

1. `handoff-memory`: loads this file (it auto-loads at session start).
2. `superpowers:verification-before-completion`: the epoch proof and every Runbook C read-back.
3. `solana-dev`: C8 to C13.
4. `simplify` and `superpowers:test-driven-development`: only for the queued cleanups, after C7.
5. `handoff`: at the end.

## For /organic-sync

Downstream: nothing in `organic-app`, the vault or the public `hyphae-program` repo changed today. Record: the Ledger devnet rehearsal and the browser claim passed (Cisco's 2026-09-28 rulings satisfied, so the 2026-09-29 yes to C1 to C13 applies); the epoch 1 proof and the mainnet steps are still ahead; MYCEL has zero submissions so far.
