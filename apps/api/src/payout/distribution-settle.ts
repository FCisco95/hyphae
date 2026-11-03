import {
  accrualOf,
  assembleDistribution,
  buildDistribution,
  type DistributionEpochEvidence,
  type DistributionMember,
  decide,
  feeDerivedVolume,
  type MemberEpochManifest,
  type PayoutPolicy,
  type PendingEpoch,
} from "@hyphae/core";
import {
  communities,
  type Db,
  epochPayoutDecisions,
  epochs,
  leaves,
  payoutPolicies,
} from "@hyphae/db";
import { and, asc, eq, inArray, isNotNull, isNull, notExists, or, sql } from "drizzle-orm";
import { readOnly } from "../pg.js";
import { backfillEpochCommitments } from "./commitment-store.js";
import {
  type DistributionIntent,
  insertDistributionIntent,
  loadDistributionIntent,
} from "./distribution-intent.js";
import {
  type Blocker,
  evaluatePayoutGate,
  type GateDeps,
  HOLD_WINDOW_MS,
  type PayoutGate,
  payoutGateIn,
} from "./gate.js";
import { epochManifestsIn, type JudgedGate, type PublicationSettings } from "./publication.js";
import type { OnChainEpoch, PublishArgs } from "./publish.js";
import type { RulesTest } from "./rules-test.js";
import { clearedMembers } from "./shared-handles.js";

// The settle loop (Organic design 2026-11-03, §6 to §10): one community's closed epochs are
// decided in index order once their payout gate is final. An epoch whose volume misses the
// threshold is rolled over, which sends nothing and leaves its lamports free in the vault. When
// the threshold is met, every rolled-over epoch is paid in one distribution published under the
// latest epoch's index. The send and the record follow publish.ts: the intent is stored before
// any send, only ever re-sent as stored, and an epoch already on-chain must equal it.
// A community without a payout policy is never touched: the operator's publish path stays as is.

// The community account and its vault, read together in one call so the outstanding figure and
// the vault balance come from one bank state: two reads could straddle a publication or a claim
// and pair a balance with a stale outstanding (review 2026-11-03, P1).
export interface SettleCommunity {
  address: string;
  // The admin key fixed in the community's address: the only key publish_epoch accepts.
  admin: string;
  feeRecipient: string;
  // Lamports reserved by published epochs and not yet claimed.
  outstandingLamports: bigint;
  vaultLamports: bigint;
  // The rent-exempt minimum of the vault account on this cluster, read live (never hard-coded).
  rentExemptMinimum: bigint;
}

export interface Publisher {
  // The key that signs; a publish is sent only when it is the community's admin.
  address: string;
  publishEpoch(input: PublishArgs): Promise<string>;
}

export interface SettleChain {
  network: MemberEpochManifest["network"];
  programId: string;
  // The community account the operator bound, with its vault, as one snapshot; null when there
  // is no community at that address for this mint.
  readCommunity(input: { mint: string; address: string }): Promise<SettleCommunity | null>;
  readEpoch(community: string, index: bigint): Promise<OnChainEpoch | null>;
  // Null when the worker holds no publisher key: a distribution is then planned, not sent.
  publisher: Publisher | null;
  // For an epoch found already on-chain: the transaction that created it with these commitments.
  publishSignature(input: PublishArgs): Promise<string>;
}

export type PlannedReason = "auto_publish_off" | "no_publisher" | "publisher_not_admin";

export interface DistributionSummary {
  epochIndex: number;
  // The on-chain gross: the sum of every pending accrual.
  grossLamports: bigint;
  allocatedLamports: bigint;
  leaves: number;
  // How many epochs the distribution pays, the index epoch included.
  epochs: number;
  root: string;
  auditHash: string;
}

export type SettleOutcome =
  | { status: "no_policy" }
  | { status: "refused"; reason: "community_not_on_chain" }
  | { status: "nothing_due" }
  | { status: "waiting"; epochIndex: number; blockers: Blocker[] }
  | {
      status: "rolled_over";
      epochIndex: number;
      reason: "below_threshold" | "volume_unknown" | "no_payable_member";
      accrualLamports: bigint;
      volumeLamports: bigint | null;
    }
  | ({ status: "planned"; reason: PlannedReason } & DistributionSummary)
  | ({ status: "published"; signature: string; recovered: boolean } & DistributionSummary);

export interface SettleDeps {
  tests?: readonly RulesTest[];
  clock?: () => Date;
  // Told about a distribution that waits for a human: auto_publish is off or no admin key signs.
  notify?: (planned: Extract<SettleOutcome, { status: "planned" }>) => Promise<void>;
}

type PolicyRow = typeof payoutPolicies.$inferSelect;
type EpochRef = { communityId: string; epochId: string };

const PG_BIGINT_MAX = 9_223_372_036_854_775_807n;

const toPolicy = (row: PolicyRow): PayoutPolicy => ({
  thresholdVolumeLamports: row.thresholdVolumeLamports,
  basis: row.basis === "per_epoch" ? "per_epoch" : "cumulative",
  rewardBpsOfVolume: row.rewardBpsOfVolume === null ? null : BigInt(row.rewardBpsOfVolume),
});

const toMember = (m: JudgedGate["members"][number]): DistributionMember => ({
  memberId: m.memberId,
  pointUnits: BigInt(m.pointUnits),
  payable: m.status === "payable",
  wallet: m.wallet,
});

// A gate that can no longer change: ready, or blocked only because nobody is payable once the
// hold window has passed (no balance can be recorded any more). Anything else waits.
function finalGate(gate: PayoutGate, now: Date): JudgedGate | null {
  if (gate.status === "ready") return gate;
  const nobody = gate.blockers.length === 1 && gate.blockers[0] === "no_payable_members";
  if (!nobody || !gate.snapshot || gate.testId === null || gate.hold === null) return null;
  if (now.getTime() <= gate.closesAt.getTime() + HOLD_WINDOW_MS) return null;
  return {
    epochIndex: gate.epochIndex,
    testId: gate.testId,
    hold: gate.hold,
    members: gate.members,
    snapshot: gate.snapshot,
  };
}

const blockersOf = (gate: PayoutGate): Blocker[] =>
  gate.status === "blocked" ? gate.blockers : [];

// Every epoch rolled over since the last distribution, in index order.
async function pendingDecisions(db: Db, communityId: string) {
  return db
    .select({ decision: epochPayoutDecisions, epochId: epochs.id, index: epochs.index })
    .from(epochPayoutDecisions)
    .innerJoin(epochs, eq(epochs.id, epochPayoutDecisions.epochId))
    .where(
      and(
        eq(epochPayoutDecisions.communityId, communityId),
        eq(epochPayoutDecisions.outcome, "rolled_over"),
        isNull(epochPayoutDecisions.distributionEpochId),
      ),
    )
    .orderBy(asc(epochs.index));
}

// The community's settlement generation: every decision (epoch, outcome, distribution) and every
// published epoch, as one comparable string. Captured before the chain snapshot and compared
// under the community lock at the store, so a run that planned, published and recorded in between
// is caught even when no planned row remains, the epoch is still undecided and nothing is pending:
// the snapshot's lamports would otherwise be counted again (review round 2, P1).
async function settlementGeneration(db: Db, communityId: string): Promise<string> {
  const decisions = await db
    .select({
      epochId: epochPayoutDecisions.epochId,
      outcome: epochPayoutDecisions.outcome,
      distributionEpochId: epochPayoutDecisions.distributionEpochId,
    })
    .from(epochPayoutDecisions)
    .where(eq(epochPayoutDecisions.communityId, communityId))
    .orderBy(asc(epochPayoutDecisions.epochId));
  const published = await db
    .select({ id: epochs.id })
    .from(epochs)
    .where(
      and(
        eq(epochs.communityId, communityId),
        or(eq(epochs.status, "published"), isNotNull(epochs.root)),
      ),
    )
    .orderBy(asc(epochs.id));
  return JSON.stringify({ decisions, published: published.map((p) => p.id) });
}

// Under the community row lock, the state this run decided on must still hold: the settlement
// generation captured before the chain snapshot, no planned distribution, the epoch still
// undecided and the rolled-over set the build used. Otherwise another run overtook this one
// between its snapshot and its store, and this one stops without writing; the next sweep starts
// from the new state (review 2026-11-03, P1 in both rounds: two runs could otherwise store
// overlapping distributions, or count lamports a finished run already distributed).
async function reserveDecision(
  tx: Db,
  communityId: string,
  epochId: string,
  pending: readonly { epochId: string; accrualLamports: bigint }[],
  generation: string,
): Promise<void> {
  await tx
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.id, communityId))
    .for("update");
  const overtaken = (what: string) =>
    new Error(
      `settle: another run changed ${what} of community ${communityId} during this run; the next sweep retries`,
    );
  if ((await settlementGeneration(tx, communityId)) !== generation) {
    throw overtaken("the settlement state");
  }
  const [planned] = await tx
    .select({ id: epochPayoutDecisions.id })
    .from(epochPayoutDecisions)
    .where(
      and(
        eq(epochPayoutDecisions.communityId, communityId),
        eq(epochPayoutDecisions.outcome, "distribution_planned"),
      ),
    )
    .limit(1);
  if (planned) throw overtaken("the planned distribution");
  const [decided] = await tx
    .select({ id: epochPayoutDecisions.id })
    .from(epochPayoutDecisions)
    .where(eq(epochPayoutDecisions.epochId, epochId))
    .limit(1);
  if (decided) throw overtaken(`epoch ${epochId}'s decision`);
  const key = (xs: readonly { epochId: string; accrualLamports: bigint }[]) =>
    xs.map((x) => `${x.epochId}:${x.accrualLamports}`).join(",");
  const rows = await pendingDecisions(tx, communityId);
  if (
    key(rows.map((r) => ({ epochId: r.epochId, accrualLamports: r.decision.accrualLamports }))) !==
    key(pending)
  ) {
    throw overtaken("the rolled-over epochs");
  }
}

export async function settleCommunity(
  db: Db,
  chain: SettleChain,
  input: { communityId: string },
  deps: SettleDeps = {},
): Promise<SettleOutcome> {
  const { communityId } = input;
  const now = (deps.clock ?? (() => new Date()))();
  const gateDeps: GateDeps = { ...(deps.tests ? { tests: deps.tests } : {}), clock: () => now };

  const policies = await db
    .select()
    .from(payoutPolicies)
    .where(eq(payoutPolicies.communityId, communityId))
    .orderBy(asc(payoutPolicies.effectiveFromIndex));
  const first = policies[0];
  if (!first) return { status: "no_policy" };

  const [community] = await db
    .select({ mint: communities.mint, chainAddress: communities.chainAddress })
    .from(communities)
    .where(eq(communities.id, communityId));
  if (!community) throw new Error(`settle: no community ${communityId}`);
  if (community.chainAddress === null)
    return { status: "refused", reason: "community_not_on_chain" };
  // Captured before anything else is read, the chain snapshot included; compared at the store.
  const generation = await settlementGeneration(db, communityId);

  // A planned distribution is sent or recorded before any later epoch is decided: deciding past
  // it would count its epochs as pending twice.
  const [planned] = await db
    .select({ epochId: epochPayoutDecisions.epochId, index: epochs.index, policy: payoutPolicies })
    .from(epochPayoutDecisions)
    .innerJoin(epochs, eq(epochs.id, epochPayoutDecisions.epochId))
    .innerJoin(payoutPolicies, eq(payoutPolicies.id, epochPayoutDecisions.policyId))
    .where(
      and(
        eq(epochPayoutDecisions.communityId, communityId),
        eq(epochPayoutDecisions.outcome, "distribution_planned"),
      ),
    );
  // One snapshot for the whole run: the balance a decision uses is the one read here.
  const onChain = await chain.readCommunity({
    mint: community.mint,
    address: community.chainAddress,
  });
  if (onChain === null || onChain.address !== community.chainAddress) {
    return { status: "refused", reason: "community_not_on_chain" };
  }
  const settings: PublicationSettings = {
    network: chain.network,
    programId: chain.programId,
    feeRecipient: onChain.feeRecipient,
  };
  if (planned) {
    const intent = await loadDistributionIntent(db, planned.epochId);
    if (!intent) throw new Error(`settle: epoch ${planned.epochId} is planned without an intent`);
    return publishIntent(
      db,
      chain,
      { communityId, epochId: planned.epochId, index: planned.index, policy: planned.policy },
      onChain,
      intent,
      deps,
    );
  }

  // The lowest closed epoch under a policy that has no decision yet. Epochs close in index order,
  // so this is the next epoch in order; nothing is decided until it can be.
  const [next] = await db
    .select({ id: epochs.id, index: epochs.index })
    .from(epochs)
    .where(
      and(
        eq(epochs.communityId, communityId),
        eq(epochs.status, "closed"),
        sql`${epochs.index} >= ${first.effectiveFromIndex}`,
        notExists(
          db
            .select({ id: epochPayoutDecisions.id })
            .from(epochPayoutDecisions)
            .where(eq(epochPayoutDecisions.epochId, epochs.id)),
        ),
      ),
    )
    .orderBy(asc(epochs.index))
    .limit(1);
  if (!next) return { status: "nothing_due" };
  const policyRow = policies.filter((p) => p.effectiveFromIndex <= next.index).at(-1) as PolicyRow;
  const policy = toPolicy(policyRow);
  const ref: EpochRef = { communityId, epochId: next.id };

  const gate = await evaluatePayoutGate(db, ref, gateDeps);
  if (!finalGate(gate, now)) {
    return { status: "waiting", epochIndex: next.index, blockers: blockersOf(gate) };
  }

  const pendingRows = await pendingDecisions(db, communityId);
  const pendingLamports = pendingRows.reduce((s, p) => s + p.decision.accrualLamports, 0n);
  const reserved = pendingRows.map((p) => ({
    epochId: p.epochId,
    accrualLamports: p.decision.accrualLamports,
  }));

  // §6: free = lamports − rent-exempt minimum − outstanding, from the one snapshot read above;
  // the accrual is what is free beyond the epochs already rolled over.
  const free = onChain.vaultLamports - onChain.rentExemptMinimum - onChain.outstandingLamports;
  if (free < 0n) {
    throw new Error("settle: the vault holds less than its rent and its outstanding allocations");
  }
  const accrual = accrualOf(free, pendingLamports);
  // The decision columns are Postgres bigint, signed: their ceiling is 2^63 − 1, not u64's. The
  // whole SOL supply is about 5.8e17 lamports, so a value past it is a broken read; it is refused
  // here with a clear error rather than by the insert (review round 2, P2).
  if (free > PG_BIGINT_MAX || accrual > PG_BIGINT_MAX) {
    throw new Error(
      "settle: the vault's free balance exceeds the decision column's signed 64-bit range",
    );
  }
  const volume = feeDerivedVolume(accrual, policy.rewardBpsOfVolume, true);
  const decisionRow = {
    communityId,
    epochId: next.id,
    policyId: policyRow.id,
    freeLamports: free,
    accrualLamports: accrual,
    volumeLamports: volume,
  };

  // B6: a final epoch's commitments are stored under the reward-writer lock before the build.
  const inputs = [
    ...pendingRows.map((p) => ({
      ref: { communityId, epochId: p.epochId },
      index: p.index,
      accrualLamports: p.decision.accrualLamports,
      volumeLamports: p.decision.volumeLamports,
    })),
    { ref, index: next.index, accrualLamports: accrual, volumeLamports: volume },
  ];
  for (const e of inputs) await backfillEpochCommitments(db, e.ref);

  // One repeatable-read snapshot: the verdicts, the rows they judged and the manifests agree.
  const built = await readOnly(db, async (tx) => {
    const judged: { ref: EpochRef; gate: JudgedGate; input: (typeof inputs)[number] }[] = [];
    for (const e of inputs) {
      const g = await payoutGateIn(tx, e.ref, gateDeps);
      const final = finalGate(g, now);
      if (!final) {
        return { status: "waiting" as const, epochIndex: e.index, blockers: blockersOf(g) };
      }
      judged.push({ ref: e.ref, gate: final, input: e });
    }
    const pending: PendingEpoch[] = judged.map((j) => ({
      index: BigInt(j.input.index),
      accrualLamports: j.input.accrualLamports,
      volumeLamports: j.input.volumeLamports,
      members: j.gate.members.map(toMember),
    }));
    const decision = decide(policy, pending);
    if (decision.outcome === "rolled_over") {
      return { status: "rolled_over" as const, reason: decision.reason };
    }

    const distribution = buildDistribution(pending);
    const zero = { uncappedLamports: 0n, amountLamports: 0n, capRemainderLamports: 0n };
    const evidence: DistributionEpochEvidence[] = [];
    const cleared: { epochId: string; members: string[] }[] = [];
    for (const j of judged) {
      // Each epoch's B7 manifests carry that epoch's slice shares; an epoch merged into another
      // slice (nobody payable) carries none.
      const slice = distribution.slices.find((s) => s.epochIndex === BigInt(j.input.index));
      const shareOf = slice ? new Map(slice.members.map((m) => [m.memberId, m])) : null;
      const manifests = await epochManifestsIn(tx, j.ref, j.gate, settings, (memberId) =>
        shareOf ? shareOf.get(memberId) : zero,
      );
      evidence.push({
        epoch: manifests.base.epoch,
        configHash: manifests.base.config_hash,
        snapshot: {
          closed_at: j.gate.snapshot.closedAt,
          cutoff_assumption: j.gate.snapshot.cutoffAssumption,
        },
        entries: manifests.entries,
        members: manifests.members,
        volumeLamports: j.input.volumeLamports,
        rulesTestId: j.gate.testId,
        hold: { mint: j.gate.hold.mint, threshold_raw: j.gate.hold.thresholdRaw.toString() },
      });
      cleared.push({ epochId: j.ref.epochId, members: await clearedMembers(tx, j.ref.epochId) });
    }
    const assembled = assembleDistribution({
      network: settings.network,
      programId: settings.programId,
      communityId,
      mint: community.mint,
      feeRecipient: settings.feeRecipient,
      policy,
      volumeLamports: decision.volumeLamports,
      distribution,
      epochs: evidence,
    });
    return { status: "distribute" as const, assembled, cleared };
  });

  if (built.status === "waiting") return built;
  if (built.status === "rolled_over") {
    // Guarantee 1: nothing is sent; the lamports stay free in the vault for the next decision.
    await db.transaction(async (tx) => {
      await reserveDecision(tx, communityId, next.id, reserved, generation);
      await tx
        .insert(epochPayoutDecisions)
        .values({ ...decisionRow, outcome: "rolled_over", reason: built.reason });
    });
    return {
      status: "rolled_over",
      epochIndex: next.index,
      reason: built.reason,
      accrualLamports: accrual,
      volumeLamports: volume,
    };
  }

  // The intent and the planned decision land together, under the community lock (no other run
  // overtook this one) and the epoch row locks clearSharedHandle takes: a clearance the build did
  // not see refuses the store, and none can land once the intent exists.
  await db.transaction(async (tx) => {
    await reserveDecision(tx, communityId, next.id, reserved, generation);
    for (const c of built.cleared) {
      await tx.select({ id: epochs.id }).from(epochs).where(eq(epochs.id, c.epochId)).for("update");
      if ((await clearedMembers(tx, c.epochId)).join() !== c.members.join()) {
        throw new Error(
          `settle: a shared-handle clearance for epoch ${c.epochId} was recorded during planning; plan again`,
        );
      }
    }
    await insertDistributionIntent(tx, ref, onChain.address, built.assembled);
    await tx
      .insert(epochPayoutDecisions)
      .values({ ...decisionRow, outcome: "distribution_planned", distributionEpochId: next.id });
  });
  const intent = await loadDistributionIntent(db, next.id);
  if (
    !intent ||
    intent.auditHash !== built.assembled.auditHash ||
    intent.communityAddress !== onChain.address
  ) {
    throw new Error(`settle: epoch ${next.id}'s distribution differs from its stored intent`);
  }
  return publishIntent(
    db,
    chain,
    { communityId, epochId: next.id, index: next.index, policy: policyRow },
    onChain,
    intent,
    deps,
  );
}

// From a stored intent to the chain and the record, as publish.ts does for one epoch. Without
// auto_publish, or without the admin key, the distribution stays planned; an epoch that is
// already on-chain is recorded in any case.
async function publishIntent(
  db: Db,
  chain: SettleChain,
  target: { communityId: string; epochId: string; index: number; policy: PolicyRow },
  onChain: SettleCommunity,
  intent: DistributionIntent,
  deps: SettleDeps,
): Promise<SettleOutcome> {
  const s = intent.audit.settlement;
  if (
    intent.audit.network !== chain.network ||
    intent.audit.program_id !== chain.programId ||
    intent.communityAddress !== onChain.address ||
    s.fee_recipient !== onChain.feeRecipient
  ) {
    throw new Error(
      `settle: the stored distribution intent for epoch ${target.epochId} was made for another network or community`,
    );
  }
  const index = BigInt(target.index);
  if (intent.audit.distribution.index !== index.toString()) {
    throw new Error(`settle: the stored intent for epoch ${target.epochId} names another index`);
  }
  const summary: DistributionSummary = {
    epochIndex: target.index,
    grossLamports: BigInt(s.gross_lamports),
    allocatedLamports: BigInt(s.allocated_lamports),
    leaves: intent.leaves.length,
    epochs: intent.audit.epochs.length,
    root: intent.root,
    auditHash: intent.auditHash,
  };
  const intended: OnChainEpoch = {
    root: intent.root,
    auditHash: intent.auditHash,
    grossLamports: summary.grossLamports,
    allocatedLamports: summary.allocatedLamports,
  };
  const args: PublishArgs = {
    community: onChain.address,
    index,
    ...intended,
    feeRecipient: s.fee_recipient,
  };

  const existing = await chain.readEpoch(onChain.address, index);
  let signature: string;
  if (existing) {
    const same =
      existing.root === intended.root &&
      existing.auditHash === intended.auditHash &&
      existing.grossLamports === intended.grossLamports &&
      existing.allocatedLamports === intended.allocatedLamports;
    if (!same) {
      throw new Error(`settle: epoch ${index} is on-chain and differs from this distribution`);
    }
    signature = await chain.publishSignature(args);
  } else {
    const reason: PlannedReason | null = !target.policy.autoPublish
      ? "auto_publish_off"
      : chain.publisher === null
        ? "no_publisher"
        : chain.publisher.address !== onChain.admin
          ? "publisher_not_admin"
          : null;
    if (reason !== null || chain.publisher === null) {
      const planned = { status: "planned" as const, reason: reason ?? "no_publisher", ...summary };
      await deps.notify?.(planned);
      return planned;
    }
    signature = await chain.publisher.publishEpoch(args);
  }

  await db.transaction(async (tx) => {
    const [epoch] = await tx
      .select({ root: epochs.root })
      .from(epochs)
      .where(and(eq(epochs.id, target.epochId), eq(epochs.communityId, target.communityId)))
      .for("update");
    if (!epoch) throw new Error(`settle: epoch ${target.epochId} vanished`);
    if (epoch.root !== null) {
      if (epoch.root === intent.root) return;
      throw new Error(`settle: epoch ${target.epochId} was recorded with another root`);
    }
    await tx.insert(leaves).values(
      intent.leaves.map((l) => ({
        epochId: target.epochId,
        memberId: l.memberId,
        wallet: l.wallet,
        score: l.score,
        amountLamports: l.amountLamports,
        evidenceHash: l.evidenceHash,
        proof: l.proof,
      })),
    );
    await tx
      .update(epochs)
      .set({
        status: "published",
        root: intent.root,
        potLamports: intended.grossLamports,
        publishTx: signature,
        publishedAt: sql`clock_timestamp()`,
      })
      .where(eq(epochs.id, target.epochId));
    // Every epoch the distribution pays, the index epoch included, is paid in this one.
    await tx
      .update(epochPayoutDecisions)
      .set({ outcome: "distributed", distributionEpochId: target.epochId })
      .where(
        and(
          eq(epochPayoutDecisions.communityId, target.communityId),
          inArray(
            epochPayoutDecisions.epochId,
            intent.audit.epochs.map((e) => e.epoch.id),
          ),
        ),
      );
  });

  return { status: "published", signature, recovered: existing !== null, ...summary };
}

// Communities under a payout policy: the sweep queues one settle job for each.
export async function dueSettles(db: Db): Promise<{ communityId: string }[]> {
  return db
    .selectDistinct({ communityId: payoutPolicies.communityId })
    .from(payoutPolicies)
    .orderBy(asc(payoutPolicies.communityId));
}
