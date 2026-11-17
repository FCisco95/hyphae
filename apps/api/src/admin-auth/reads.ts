import type { OperatorEpoch, OperatorOverview, OperatorPayable, OperatorTopUp } from "@hyphae/core";
import {
  type communities,
  type Db,
  epochPayoutDecisions,
  epochs,
  payoutPolicies,
} from "@hyphae/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { readOperatorSummary } from "../member-journey/operator.js";
import type { SettleChain } from "../payout/distribution-settle.js";
import { evaluatePayoutGate, type GateDeps, type PayoutGate } from "../payout/gate.js";
import { dueGateReady } from "../payout/gate-ready.js";
import { communityHold } from "../payout/holds.js";

// The operator page's reads. Read-only: every function here only selects, and the payout
// functions it calls (the gate, the gate-ready numbers) are the read-only ones the settle loop
// and the gate-ready message use. No wallet is ever placed next to a handle, member or points.

type Community = typeof communities.$inferSelect & { chainAddress: string };

export interface OperatorReadDeps {
  network: "solana:mainnet" | "solana:devnet";
  // The settle loop's chain, read-only (no publisher). Absent or failing: chain_unavailable.
  settle?: () => Promise<SettleChain>;
  gate?: GateDeps;
  now?: () => Date;
}

const MAX_EPOCHS = 12;
const DECISIONS = new Set(["distribution_planned", "rolled_over", "distributed"]);

function gateView(gate: PayoutGate | null): OperatorEpoch["gate"] {
  if (gate === null)
    return { status: "not_evaluated", blockers: [], payable: 0, held: 0, not_payable: 0 };
  const by = (s: string) => gate.members.filter((m) => m.status === s).length;
  return {
    status: gate.status,
    blockers: gate.status === "blocked" ? [...gate.blockers] : [],
    payable: by("payable"),
    held: by("held"),
    not_payable: by("not_payable"),
  };
}

// The gate is judged only where it can still decide something: a closed epoch with no root.
const judged = (e: { status: string; root: string | null }) =>
  e.status === "closed" && e.root === null;

async function topUp(
  db: Db,
  community: Community,
  policy: boolean,
  deps: OperatorReadDeps,
): Promise<OperatorTopUp> {
  if (communityHold(community.mint)) return { status: "held" };
  if (!policy) return { status: "no_policy" };
  if (!deps.settle) return { status: "chain_unavailable" };
  try {
    const chain = await deps.settle();
    const notes = await dueGateReady(db, chain, { communityId: community.id }, deps.gate ?? {});
    const newest = notes.at(-1);
    if (!newest) return { status: "none" };
    return {
      status: "ok",
      epoch_index: newest.epochIndex,
      outcome: newest.outcome,
      lamports: newest.topUpLamports === null ? null : newest.topUpLamports.toString(),
    };
  } catch {
    // Chain and provider errors can carry RPC URLs with keys: never echoed.
    return { status: "chain_unavailable" };
  }
}

type Summary = Extract<
  Awaited<ReturnType<typeof readOperatorSummary>>,
  { status: "ok" }
>["summary"];

// The /ops summary's job health, plus the payout queues for this community.
async function jobs(
  db: Db,
  community: Community,
  summary: Summary,
): Promise<OperatorOverview["jobs"]> {
  if (summary.jobs.status !== "available") return { status: "unavailable" };
  try {
    const payout = await db.transaction(
      (tx) =>
        tx
          .select({
            name: sql<string>`j.name`,
            state: sql<string>`j.state::text`,
            count: count(),
          })
          .from(sql`pgboss.job j`)
          .where(
            sql`j.name in ('payout-settle', 'gate-ready') and j.data->>'communityId' = ${community.id}`,
          )
          .groupBy(sql`j.name`, sql`j.state`),
      { accessMode: "read only" },
    );
    return {
      status: "available",
      groups: [...summary.jobs.groups, ...payout].map((g) => ({
        name: g.name,
        state: g.state,
        count: Number(g.count),
      })),
    };
  } catch {
    return { status: "unavailable" };
  }
}

function raids(s: Summary): OperatorOverview["raids"] {
  return {
    by_state: s.raids.map((r) => ({ state: r.state, count: Number(r.count) })),
    active: s.activeRaids.map((r) => ({
      id: r.id,
      target_url: r.targetUrl,
      closes_at: r.closesAt.toISOString(),
    })),
    deliveries: s.deliveries.map((d) => ({ status: d.status, count: Number(d.count) })),
  };
}

export async function operatorOverview(
  db: Db,
  community: Community,
  deps: OperatorReadDeps,
): Promise<OperatorOverview> {
  const now = deps.now?.() ?? new Date();
  const [policy] = await db
    .select({ id: payoutPolicies.id })
    .from(payoutPolicies)
    .where(eq(payoutPolicies.communityId, community.id))
    .limit(1);
  const rows = await db
    .select({
      id: epochs.id,
      index: epochs.index,
      status: epochs.status,
      closesAt: epochs.closesAt,
      root: epochs.root,
      publishTx: epochs.publishTx,
      outcome: epochPayoutDecisions.outcome,
    })
    .from(epochs)
    .leftJoin(epochPayoutDecisions, eq(epochPayoutDecisions.epochId, epochs.id))
    .where(eq(epochs.communityId, community.id))
    .orderBy(desc(epochs.index))
    .limit(MAX_EPOCHS);
  // The /ops summary authorizes by the designated Telegram admin; the caller has already proven
  // the on-chain admin, so it is asked as that admin. Only raid and job fields are taken from it.
  const summary = await readOperatorSummary(db, {
    communityId: community.id,
    actorId: community.adminTelegramUserId,
  });
  if (summary.status !== "ok") throw new Error("operator: summary unavailable");
  const list: OperatorEpoch[] = [];
  for (const e of rows) {
    const gate = judged(e)
      ? await evaluatePayoutGate(db, { communityId: community.id, epochId: e.id }, deps.gate ?? {})
      : null;
    list.push({
      index: e.index,
      status: e.status,
      closes_at: e.closesAt.toISOString(),
      published: e.root !== null || e.publishTx !== null,
      decision:
        e.outcome === null
          ? null
          : DECISIONS.has(e.outcome)
            ? (e.outcome as "distribution_planned" | "rolled_over" | "distributed")
            : "other",
      gate: gateView(gate),
    });
  }
  return {
    community: {
      mint: community.mint,
      name: community.name,
      chain_address: community.chainAddress,
      network: deps.network,
    },
    hold: { held: communityHold(community.mint) !== null },
    policy: { present: policy !== undefined },
    epochs: list,
    top_up: await topUp(db, community, policy !== undefined, deps),
    raids: raids(summary.summary),
    jobs: await jobs(db, community, summary.summary),
    as_of: now.toISOString(),
  };
}

// Null for an unknown epoch.
export async function operatorPayable(
  db: Db,
  community: Community,
  index: number,
  deps: OperatorReadDeps,
): Promise<OperatorPayable | null> {
  const [epoch] = await db
    .select({ id: epochs.id, status: epochs.status, root: epochs.root })
    .from(epochs)
    .where(and(eq(epochs.communityId, community.id), eq(epochs.index, index)));
  if (!epoch) return null;
  if (!judged(epoch)) return { epoch_index: index, gate_status: "not_evaluated", wallets: [] };
  const gate = await evaluatePayoutGate(
    db,
    { communityId: community.id, epochId: epoch.id },
    deps.gate ?? {},
  );
  const wallets = gate.members
    .filter((m) => m.status === "payable" && m.wallet !== null)
    .map((m) => m.wallet as string)
    .sort();
  return { epoch_index: index, gate_status: gate.status, wallets };
}
