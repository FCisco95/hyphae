import { createHash } from "node:crypto";
import { BASIS_POINTS } from "@hyphae/core";
import { communities, type Db, epochPayoutDecisions, epochs, payoutPolicies } from "@hyphae/db";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { loadDistributionIntent } from "./distribution-intent.js";
import type { SettleChain } from "./distribution-settle.js";
import { evaluatePayoutGate, type GateDeps } from "./gate.js";
import { communityHold } from "./holds.js";

// The gate-ready message: when an epoch of a community under a payout policy has a ready gate,
// the operator hears once how many members are payable and how much the vault still needs to
// reach the policy's volume threshold. Read-only: nothing here decides, plans or sends funds.

export interface GateReadyNote {
  communityId: string;
  epochId: string;
  communityName: string;
  mint: string;
  epochIndex: number;
  // planned: the settle loop stored a distribution that waits for the operator's signature.
  // rolled_over: the volume threshold was not met; nothing is sent until a later decision pays.
  outcome: "planned" | "rolled_over";
  payable: number;
  // Lamports to add to the vault for the threshold to be met; null when the policy cannot say.
  topUpLamports: bigint | null;
  // Who is told: the community's registered admin.
  adminTelegramUserId: bigint;
}

// The note as a queue job's JSON: bigints travel as decimal strings.
export interface GateReadyJob extends Omit<GateReadyNote, "topUpLamports" | "adminTelegramUserId"> {
  topUp: string | null;
  adminTelegramUserId: string;
}

export const toGateReadyJob = (n: GateReadyNote): GateReadyJob => {
  const { topUpLamports, adminTelegramUserId, ...rest } = n;
  return {
    ...rest,
    topUp: topUpLamports === null ? null : topUpLamports.toString(),
    adminTelegramUserId: adminTelegramUserId.toString(),
  };
};

export const fromGateReadyJob = (j: GateReadyJob): GateReadyNote => {
  const { topUp, adminTelegramUserId, ...rest } = j;
  return {
    ...rest,
    topUpLamports: topUp === null ? null : BigInt(topUp),
    adminTelegramUserId: BigInt(adminTelegramUserId),
  };
};

// A job id derived from the epoch: queueing the same epoch again conflicts on the id and is
// ignored by the queue, whatever restarts happened in between.
export function gateReadyJobId(epochId: string): string {
  const h = createHash("sha256").update(`hyphae:gate-ready:${epochId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// The extra vault lamports at which this policy's volume threshold is met. The volume of an
// accrual is accrual * 10000 / bps (distribution.ts, feeDerivedVolume), so the answer rounds up.
export function topUpToThreshold(input: {
  thresholdVolumeLamports: bigint;
  basis: "cumulative" | "per_epoch";
  rewardBpsOfVolume: bigint | null;
  // The volume of the epochs already rolled over, which count toward a cumulative threshold.
  pendingVolumeLamports: bigint;
  // What reached the vault since the last decision.
  accrualLamports: bigint;
}): bigint | null {
  const counted = input.basis === "cumulative" ? input.pendingVolumeLamports : 0n;
  const volumeNeeded = input.thresholdVolumeLamports - counted;
  // Decided first, as `decide` does: volume already pending can meet a cumulative threshold
  // without any reward share.
  if (volumeNeeded <= 0n) return 0n;
  const bps = input.rewardBpsOfVolume;
  if (bps === null || bps <= 0n) return null;
  const accrualNeeded = (volumeNeeded * bps + BASIS_POINTS - 1n) / BASIS_POINTS;
  return accrualNeeded > input.accrualLamports ? accrualNeeded - input.accrualLamports : 0n;
}

const sol = (lamports: bigint) => {
  const whole = lamports / 1_000_000_000n;
  const frac = (lamports % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
};

export function gateReadyText(n: GateReadyNote): string {
  if (n.outcome === "planned") {
    return [
      `${n.communityName}: epoch ${n.epochIndex} is ready and its distribution is planned.`,
      `${n.payable} payable members.`,
      `Publish it with the Ledger: publish-epoch run --mint ${n.mint}`,
    ].join("\n");
  }
  const top =
    n.topUpLamports === null
      ? "Top-up unknown: the payout policy sets no reward share."
      : n.topUpLamports === 0n
        ? "No top-up needed: the vault already meets the threshold."
        : `Top-up needed: ${sol(n.topUpLamports)} SOL (${n.topUpLamports} lamports) to the vault.`;
  return [
    `${n.communityName}: epoch ${n.epochIndex} is ready but rolled over: its volume is below the policy threshold, so nothing is paid yet.`,
    `${n.payable} payable members.`,
    `${top} The next epoch's decision pays every rolled-over epoch once the threshold is met.`,
  ].join("\n");
}

// A planned distribution pays every rolled-over epoch, so rollover notices for them are
// superseded the moment it exists: only the planned one is reported.
export function notifiable<T extends { outcome: string }>(decided: readonly T[]): T[] {
  const planned = decided.filter((d) => d.outcome === "distribution_planned");
  return planned.length > 0 ? planned : [...decided];
}

// The note for one epoch as things stand now, or null when it has none: published, superseded by
// a planned distribution, held, or no longer decided. Delivery rebuilds the message from this
// instead of trusting the queued snapshot, which may be stale. Only the instant between this read
// and the Telegram call is unguarded; the message is advice, and `run` prints the plan before the
// Ledger is asked.
export async function currentGateReadyNote(
  db: Db,
  chain: SettleChain,
  ref: { communityId: string; epochId: string },
  deps: GateDeps = {},
): Promise<GateReadyNote | null> {
  const notes = await dueGateReady(db, chain, { communityId: ref.communityId }, deps);
  return notes.find((n) => n.epochId === ref.epochId) ?? null;
}

// Decided epochs of one policy community whose gate is ready, with the numbers the message states. Empty for a
// community without a policy, under a recorded hold, not bound on-chain, or with an unreadable
// vault: a message that cannot be right is not sent.
export async function dueGateReady(
  db: Db,
  chain: SettleChain,
  input: { communityId: string },
  deps: GateDeps = {},
): Promise<GateReadyNote[]> {
  const [community] = await db
    .select({
      name: communities.name,
      mint: communities.mint,
      chainAddress: communities.chainAddress,
      adminTelegramUserId: communities.adminTelegramUserId,
    })
    .from(communities)
    .where(eq(communities.id, input.communityId));
  if (!community || community.chainAddress === null || communityHold(community.mint)) return [];
  const policies = await db
    .select()
    .from(payoutPolicies)
    .where(eq(payoutPolicies.communityId, input.communityId))
    .orderBy(asc(payoutPolicies.effectiveFromIndex));
  const first = policies[0];
  if (!first) return [];
  const onChain = await chain.readCommunity({
    mint: community.mint,
    address: community.chainAddress,
  });
  if (onChain === null || onChain.address !== community.chainAddress) return [];

  const rolled = await db
    .select({
      accrual: epochPayoutDecisions.accrualLamports,
      volume: epochPayoutDecisions.volumeLamports,
    })
    .from(epochPayoutDecisions)
    .where(
      and(
        eq(epochPayoutDecisions.communityId, input.communityId),
        eq(epochPayoutDecisions.outcome, "rolled_over"),
        isNull(epochPayoutDecisions.distributionEpochId),
      ),
    );
  const pendingLamports = rolled.reduce((s, r) => s + r.accrual, 0n);
  const pendingVolume = rolled.reduce((s, r) => s + (r.volume ?? 0n), 0n);
  const free = onChain.vaultLamports - onChain.rentExemptMinimum - onChain.outstandingLamports;
  if (free < pendingLamports) return [];
  const accrual = free - pendingLamports;

  // Only epochs the settle loop has decided, as it decides them: a planned distribution (the
  // one `run` publishes) or a rollover still waiting for a later distribution. An undecided
  // epoch is reported after the loop decides it, so a message never describes a state the loop
  // is about to change, and an epoch is never counted twice.
  const decided = await db
    .select({
      id: epochs.id,
      index: epochs.index,
      outcome: epochPayoutDecisions.outcome,
    })
    .from(epochPayoutDecisions)
    .innerJoin(epochs, eq(epochs.id, epochPayoutDecisions.epochId))
    .where(
      and(
        eq(epochPayoutDecisions.communityId, input.communityId),
        or(
          eq(epochPayoutDecisions.outcome, "distribution_planned"),
          and(
            eq(epochPayoutDecisions.outcome, "rolled_over"),
            isNull(epochPayoutDecisions.distributionEpochId),
          ),
        ),
        eq(epochs.status, "closed"),
        isNull(epochs.root),
      ),
    )
    .orderBy(asc(epochs.index));
  // The policy that decides the next epoch, as settleCommunity picks it: the lowest epoch with no
  // decision, or the one after the last epoch when every epoch is decided.
  const all = await db
    .select({ index: epochs.index, decided: epochPayoutDecisions.id })
    .from(epochs)
    .leftJoin(epochPayoutDecisions, eq(epochPayoutDecisions.epochId, epochs.id))
    .where(eq(epochs.communityId, input.communityId))
    .orderBy(asc(epochs.index));
  const undecided = all.find((e) => e.decided === null && e.index >= first.effectiveFromIndex);
  const nextIndex = undecided?.index ?? (all.at(-1)?.index ?? 0) + 1;
  const next = policies.filter((x) => x.effectiveFromIndex <= nextIndex).at(-1) ?? first;
  const notes: GateReadyNote[] = [];
  for (const e of notifiable(decided)) {
    const planned = e.outcome === "distribution_planned";
    // A planned distribution is counted from its stored intent: it may pay several epochs, and
    // the index epoch alone may have nobody payable. A rollover is counted from its own gate.
    let payable: number;
    if (planned) {
      // The send may have landed before the database recorded it: the chain decides, and the
      // settle loop records it on its next run. Nothing is left for the operator to publish.
      if ((await chain.readEpoch(onChain.address, BigInt(e.index))) !== null) continue;
      const intent = await loadDistributionIntent(db, e.id);
      if (!intent) continue;
      payable = intent.leaves.length;
    } else {
      const gate = await evaluatePayoutGate(
        db,
        { communityId: input.communityId, epochId: e.id },
        deps,
      );
      if (gate.status !== "ready") continue;
      payable = gate.payable;
    }
    const p = next;
    notes.push({
      communityId: input.communityId,
      epochId: e.id,
      communityName: community.name,
      mint: community.mint,
      epochIndex: e.index,
      outcome: planned ? "planned" : "rolled_over",
      payable,
      adminTelegramUserId: community.adminTelegramUserId,
      // A planned distribution met its threshold when it was decided.
      topUpLamports: planned
        ? 0n
        : topUpToThreshold({
            thresholdVolumeLamports: p.thresholdVolumeLamports,
            basis: p.basis === "per_epoch" ? "per_epoch" : "cumulative",
            rewardBpsOfVolume: p.rewardBpsOfVolume === null ? null : BigInt(p.rewardBpsOfVolume),
            pendingVolumeLamports: pendingVolume,
            accrualLamports: accrual,
          }),
    });
  }
  return notes;
}
