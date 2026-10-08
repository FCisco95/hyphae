import {
  type ClaimV1,
  type CommunityV1,
  type ContributionRowV1,
  type ContributionsV1,
  type ContributionV1,
  creditRule,
  type EpochV1,
  exactPoints,
  type LeaderboardV1,
  type PayoutV1,
  type PointUnits,
  type RevisionV1,
  type SelectedV1,
  type WalletClaimsV1,
  wholePoints,
} from "@hyphae/core";
import {
  communities,
  contributions,
  type Db,
  epochPublications,
  epochs,
  leaves,
  memberWalletLinks,
  rewardConfigs,
  rewardDecisions,
  rewardDispatches,
  rewardEpochSnapshots,
  rewardIntakes,
  rewardNominations,
  rewardSnapshotEntries,
  rewardSnapshotMembers,
} from "@hyphae/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { loadIntent } from "../payout/intent.js";
import { epochPayouts } from "../payout/readiness.js";
import { isoUs, readOnly } from "../pg.js";
import { amendmentsOf } from "../rewards/amendment.js";
import { RewardConfigPayload } from "../rewards/config.js";
import { correctionRecord, effortCriteriaRecord } from "../rewards/decisions.js";
import { selectEffective } from "../rewards/effective.js";
import {
  CHAIN_DEADLINE_MS,
  claimOf,
  firstV1Section,
  LOOKUPS_AT_ONCE,
  mapLimit,
  type PublicationFacts,
  type SettlementReader,
  settlementOf,
  walletClaimOf,
} from "./settlement.js";
import { readVault } from "./vault.js";

// The public read API v1 (H-CONTRACT Part A). Every function selects named columns only, so no
// Telegram id, username, session, proof or idempotency key can reach a response (A5), and none
// takes a row lock (A12): an open epoch is provisional anyway, and final numbers come from the
// snapshot that close wrote under the lock.

type State = ContributionRowV1["state"];
type EpochRow = typeof epochs.$inferSelect;

export interface Page {
  offset: number;
  limit: number;
  member?: string | undefined;
}

const dateUs = (d: Date) => d.toISOString().replace("Z", "000Z");

async function findCommunity(tx: Db, mint: string) {
  const [row] = await tx
    .select({
      id: communities.id,
      mint: communities.mint,
      name: communities.name,
      pausedAt: communities.rewardIntakePausedAt,
      firstPaidEpoch: communities.firstPaidEpoch,
      chainAddress: communities.chainAddress,
    })
    .from(communities)
    .where(eq(communities.mint, mint));
  return row;
}

interface EpochView {
  row: EpochRow;
  opensAt: string;
  closesAt: string;
  snapshot: { id: string; closedAt: string; cutoffAssumption: string } | null;
}

async function findEpochs(tx: Db, communityId: string, index?: number): Promise<EpochView[]> {
  const rows = await tx
    .select({
      row: epochs,
      opensAt: isoUs(epochs.opensAt),
      closesAt: isoUs(epochs.closesAt),
      snapshotId: rewardEpochSnapshots.id,
      closedAt: isoUs(rewardEpochSnapshots.closedAt),
      cutoffAssumption: rewardEpochSnapshots.cutoffAssumption,
    })
    .from(epochs)
    .leftJoin(rewardEpochSnapshots, eq(rewardEpochSnapshots.epochId, epochs.id))
    .where(
      and(
        eq(epochs.communityId, communityId),
        // Legacy epochs have no reward configuration and are never served.
        isNotNull(epochs.rewardConfigId),
        index === undefined ? undefined : eq(epochs.index, index),
      ),
    )
    .orderBy(desc(epochs.index));
  return rows.map((r) => ({
    row: r.row,
    opensAt: r.opensAt,
    closesAt: r.closesAt,
    snapshot:
      r.snapshotId && r.cutoffAssumption !== null
        ? { id: r.snapshotId, closedAt: r.closedAt, cutoffAssumption: r.cutoffAssumption }
        : null,
  }));
}

const isClosed = (e: EpochRow, now: Date) => now.getTime() >= e.closesAt.getTime();

function epochStatus(e: EpochView, now: Date): EpochV1["status"] {
  if (e.snapshot) return "closed";
  if (isClosed(e.row, now)) return "closing";
  return now.getTime() < e.row.opensAt.getTime() ? "scheduled" : "open";
}

async function findEpoch(tx: Db, mint: string, index: number) {
  const community = await findCommunity(tx, mint);
  if (!community) return undefined;
  const [epoch] = await findEpochs(tx, community.id, index);
  return epoch ? { community, epoch } : undefined;
}

interface Entry {
  contributionId: string;
  memberId: string;
  state: State;
  decisionId: string | null;
  acceptedAt: string;
  taskId: string | null;
}

const intakeColumns = {
  contributionId: rewardIntakes.contributionId,
  memberId: rewardIntakes.memberId,
  acceptedAt: isoUs(rewardIntakes.acceptedAt),
  taskId: rewardIntakes.taskId,
};
const intakeOrder = [asc(rewardIntakes.acceptedAt), asc(rewardIntakes.contributionId)];
const intakeScope = (epoch: EpochView, member?: string) =>
  and(
    eq(rewardIntakes.epochId, epoch.row.id),
    member ? eq(rewardIntakes.memberId, member) : undefined,
  );

type EntryState = { state: State; decisionId: string | null };

// The state of each named contribution: the snapshot's once final; otherwise the O6 selection at
// closes_at, and once closes_at has passed, the reason close.ts will freeze (an unresolved model
// call outranks a late decision, which outranks nothing at all).
async function statesFor(
  tx: Db,
  epoch: EpochView,
  ids: string[],
  now: Date,
): Promise<Map<string, EntryState>> {
  const states = new Map<string, EntryState>();
  if (ids.length === 0) return states;
  if (epoch.snapshot) {
    const rows = await tx
      .select({
        contributionId: rewardSnapshotEntries.contributionId,
        decisionId: rewardSnapshotEntries.decisionId,
        reason: rewardSnapshotEntries.reason,
      })
      .from(rewardSnapshotEntries)
      .where(
        and(
          eq(rewardSnapshotEntries.snapshotId, epoch.snapshot.id),
          inArray(rewardSnapshotEntries.contributionId, ids),
        ),
      );
    for (const r of rows) {
      states.set(r.contributionId, { state: r.reason ?? "counted", decisionId: r.decisionId });
    }
    return states;
  }

  const cutoff = epoch.row.closesAt.getTime();
  const decisions = await tx
    .select({
      id: rewardDecisions.id,
      contributionId: rewardDecisions.contributionId,
      acceptedAt: rewardDecisions.acceptedAt,
    })
    .from(rewardDecisions)
    .where(inArray(rewardDecisions.contributionId, ids))
    .orderBy(asc(rewardDecisions.revision));
  const lineages = new Map<string, typeof decisions>();
  for (const d of decisions) {
    lineages.set(d.contributionId, [...(lineages.get(d.contributionId) ?? []), d]);
  }
  const selected = new Map(
    ids.map((id) => [
      id,
      (lineages.get(id) ?? []).findLast((d) => d.acceptedAt.getTime() < cutoff)?.id ?? null,
    ]),
  );
  const closing = isClosed(epoch.row, now);
  const undecided = ids.filter((id) => !selected.get(id));
  const uncertain = new Set(
    closing && undecided.length
      ? (
          await tx
            .select({ contributionId: rewardDispatches.contributionId })
            .from(rewardDispatches)
            .where(
              and(
                inArray(rewardDispatches.contributionId, undecided),
                inArray(rewardDispatches.state, ["dispatched", "pending_reconciliation"]),
              ),
            )
        ).map((d) => d.contributionId)
      : [],
  );
  for (const id of ids) {
    const decisionId = selected.get(id) ?? null;
    const state: State = decisionId
      ? "counted"
      : !closing
        ? "pending"
        : uncertain.has(id)
          ? "pending_reconciliation"
          : lineages.has(id)
            ? "excluded"
            : "pending_at_close";
    states.set(id, { state, decisionId });
  }
  return states;
}

function withStates(
  intakes: Omit<Entry, "state" | "decisionId">[],
  states: Map<string, EntryState>,
): Entry[] {
  return intakes.map((i) => {
    const s = states.get(i.contributionId);
    if (!s) throw new Error(`read: contribution ${i.contributionId} has no state`);
    return { ...i, ...s };
  });
}

// Every admitted contribution of the epoch, in intake order. Epoch counts and the leaderboard need
// all of them; a list page uses pageEntries instead.
async function epochEntries(tx: Db, epoch: EpochView, now: Date): Promise<Entry[]> {
  const intakes = await tx
    .select(intakeColumns)
    .from(rewardIntakes)
    .where(intakeScope(epoch))
    .orderBy(...intakeOrder);
  return withStates(
    intakes,
    await statesFor(
      tx,
      epoch,
      intakes.map((i) => i.contributionId),
      now,
    ),
  );
}

// One page, paged in SQL, with states computed for that page only.
async function pageEntries(
  tx: Db,
  epoch: EpochView,
  page: Page,
  now: Date,
): Promise<{ total: number; entries: Entry[] }> {
  const [count] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(rewardIntakes)
    .where(intakeScope(epoch, page.member));
  const intakes = await tx
    .select(intakeColumns)
    .from(rewardIntakes)
    .where(intakeScope(epoch, page.member))
    .orderBy(...intakeOrder)
    .limit(page.limit)
    .offset(page.offset);
  const states = await statesFor(
    tx,
    epoch,
    intakes.map((i) => i.contributionId),
    now,
  );
  return { total: Number(count?.n ?? 0), entries: withStates(intakes, states) };
}

type Wallet = Pick<ContributionRowV1, "wallet" | "wallet_status">;

// A wallet is served only if the link valid at `at` was signed (A5, D3).
async function publicWallets(tx: Db, memberIds: string[], at: Date): Promise<Map<string, Wallet>> {
  const out = new Map<string, Wallet>(
    memberIds.map((m) => [m, { wallet: null, wallet_status: "none" }]),
  );
  if (memberIds.length === 0) return out;
  const rows = await tx
    .select({
      memberId: memberWalletLinks.memberId,
      wallet: memberWalletLinks.wallet,
      method: memberWalletLinks.method,
    })
    .from(memberWalletLinks)
    .where(
      and(
        inArray(memberWalletLinks.memberId, memberIds),
        lte(memberWalletLinks.validFrom, at),
        or(isNull(memberWalletLinks.validTo), gt(memberWalletLinks.validTo, at)),
      ),
    );
  for (const r of rows) {
    out.set(
      r.memberId,
      r.method === "signature"
        ? { wallet: r.wallet, wallet_status: "verified" }
        : { wallet: null, wallet_status: "unverified" },
    );
  }
  return out;
}

const walletTime = (e: EpochRow, now: Date) => (isClosed(e, now) ? e.closesAt : now);

type Decision = typeof rewardDecisions.$inferSelect & { acceptedAtUs: string };

async function decisionsById(tx: Db, ids: string[]): Promise<Map<string, Decision>> {
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({ d: rewardDecisions, acceptedAtUs: isoUs(rewardDecisions.acceptedAt) })
    .from(rewardDecisions)
    .where(inArray(rewardDecisions.id, ids));
  return new Map(rows.map((r) => [r.d.id, { ...r.d, acceptedAtUs: r.acceptedAtUs }]));
}

const flagsOf = (d: Decision) => (d.flags as string[]).slice();

function selectedView(d: Decision): SelectedV1 {
  const flags = flagsOf(d);
  return {
    revision: d.revision,
    raw_quality: d.rawQuality,
    credited_quality: d.creditedQuality,
    credit_rule: creditRule(d.rawQuality, flags, d.creditedQuality),
    flags,
    effort: d.effort,
    timing_bps: d.timingBps,
    multiplier_bps: d.multiplierBps,
    point_units: d.pointUnits.toString(),
    points: exactPoints(d.pointUnits),
    explanation: d.explanation,
    corrected: d.correctionActor !== null,
  };
}

type PayoutCommunity = Parameters<typeof epochPayouts>[1]["community"];

const payoutsOf = (
  tx: Db,
  community: PayoutCommunity,
  epoch: EpochView,
  memberIds: string[],
  now: Date,
) =>
  epochPayouts(tx, {
    community,
    epoch: epoch.row,
    snapshotId: epoch.snapshot?.id ?? null,
    closed: isClosed(epoch.row, now),
    memberIds,
  });

async function rows(
  tx: Db,
  community: PayoutCommunity,
  epoch: EpochView,
  entries: Entry[],
  now: Date,
): Promise<ContributionRowV1[]> {
  const ids = entries.map((e) => e.contributionId);
  const contribs = ids.length
    ? await tx
        .select({ id: contributions.id, kind: contributions.kind, url: contributions.url })
        .from(contributions)
        .where(inArray(contributions.id, ids))
    : [];
  const byId = new Map(contribs.map((c) => [c.id, c]));
  const decisions = await decisionsById(
    tx,
    entries.flatMap((e) => (e.decisionId ? [e.decisionId] : [])),
  );
  const memberIds = [...new Set(entries.map((e) => e.memberId))];
  const wallets = await publicWallets(tx, memberIds, walletTime(epoch.row, now));
  const payouts = (await payoutsOf(tx, community, epoch, memberIds, now)).members;
  const closed = isClosed(epoch.row, now);
  return entries.map((e) => {
    const c = byId.get(e.contributionId);
    if (!c) throw new Error(`read: contribution ${e.contributionId} missing`);
    const d = e.state === "counted" && e.decisionId ? decisions.get(e.decisionId) : undefined;
    if (e.state === "counted" && !d) throw new Error(`read: decision ${e.decisionId} missing`);
    const wallet = wallets.get(e.memberId) ?? { wallet: null, wallet_status: "none" as const };
    return {
      id: e.contributionId,
      epoch: {
        index: epoch.row.index,
        closes_at: epoch.closesAt,
        closed,
        final: epoch.snapshot !== null,
      },
      member_id: e.memberId,
      ...wallet,
      kind: c.kind,
      url: c.url,
      raid_id: e.taskId,
      accepted_at: e.acceptedAt,
      state: e.state,
      selected: d ? selectedView(d) : null,
      payout: payoutOf(payouts, e.memberId),
    };
  });
}

function payoutOf(payouts: Map<string, PayoutV1>, memberId: string): PayoutV1 {
  const payout = payouts.get(memberId);
  if (!payout) throw new Error(`read: member ${memberId} has no payout status`);
  return payout;
}

export async function readCommunity(
  db: Db,
  mint: string,
  now: Date,
  chain?: SettlementReader,
): Promise<CommunityV1 | null> {
  const until = Date.now() + CHAIN_DEADLINE_MS;
  const read = await readOnly(db, async (tx) => {
    const community = await findCommunity(tx, mint);
    if (!community) return null;
    const list = await findEpochs(tx, community.id);
    const current = list.find(
      (e) => e.row.opensAt.getTime() <= now.getTime() && !isClosed(e.row, now),
    );
    return {
      mint: community.mint,
      name: community.name,
      reward_intake: (community.pausedAt ? "paused" : "open") as CommunityV1["reward_intake"],
      current_epoch: current?.row.index ?? null,
      epochs: list.map((e) => ({
        index: e.row.index,
        opens_at: e.opensAt,
        closes_at: e.closesAt,
        status: epochStatus(e, now),
      })),
      chainAddress: community.chainAddress,
    };
  });
  if (!read) return null;
  const { chainAddress, ...body } = read;
  const vault = await readVault({ mint: body.mint, chainAddress }, chain, until);
  return { ...body, vault, as_of: dateUs(now) };
}

// The recorded publication of an epoch, as the settlement sections need it.
async function publicationFacts(
  tx: Db,
  epoch: EpochRow,
  firstPaidEpoch: number | null,
): Promise<PublicationFacts> {
  const published = epoch.publishTx !== null;
  const [row] = published
    ? await tx
        .select({ at: isoUs(epochs.publishedAt) })
        .from(epochs)
        .where(eq(epochs.id, epoch.id))
    : [];
  return {
    index: epoch.index,
    firstPaidEpoch,
    publishTx: epoch.publishTx,
    publishedAt: row?.at ?? null,
    intent: published ? await loadIntent(tx, epoch.id) : null,
  };
}

// The database is read in one snapshot; the chain is read after it, with no transaction open.
export async function readEpoch(
  db: Db,
  mint: string,
  index: number,
  now: Date,
  chain?: SettlementReader,
  deadlineMs = CHAIN_DEADLINE_MS,
): Promise<EpochV1 | null> {
  const read = await readOnly(db, async (tx) => {
    const found = await findEpoch(tx, mint, index);
    if (!found) return null;
    const { community, epoch } = found;
    const [config] = await tx
      .select({ id: rewardConfigs.id, payload: rewardConfigs.payload })
      .from(rewardConfigs)
      .where(eq(rewardConfigs.id, epoch.row.rewardConfigId ?? ""));
    if (!config) throw new Error(`read: config of epoch ${epoch.row.id} missing`);
    const payload = RewardConfigPayload.parse(config.payload);

    const entries = await epochEntries(tx, epoch, now);
    const count = (s: State) => entries.filter((e) => e.state === s).length;
    const decisions = await decisionsById(
      tx,
      entries.flatMap((e) => (e.state === "counted" && e.decisionId ? [e.decisionId] : [])),
    );
    const total = [...decisions.values()].reduce((sum, d) => sum + d.pointUnits, 0n);

    const body: Omit<EpochV1, "allocation" | "payment" | "settlement"> = {
      community: { mint: community.mint, name: community.name },
      index: epoch.row.index,
      opens_at: epoch.opensAt,
      closes_at: epoch.closesAt,
      status: epochStatus(epoch, now),
      closed: isClosed(epoch.row, now),
      final: epoch.snapshot !== null,
      as_of: dateUs(now),
      config: {
        id: config.id,
        rubric_version: payload.rubric.version,
        prompt_version: payload.scoring.promptVersion,
        effort_multiplier_bps: payload.effort.multiplierBps,
        slot_limit: payload.effort.slotLimit,
        payload: config.payload as Record<string, unknown>,
      },
      amendments: (await amendmentsOf(tx, epoch.row.id)).map(
        ({ row: a, effectiveAtUs, recordedAtUs }) => ({
          effective_at: effectiveAtUs,
          recorded_at: recordedAtUs,
          actor: a.actor,
          reason: a.reason,
          from: {
            config_id: a.fromConfigId,
            prompt_version: a.fromPromptVersion,
            prompt_template_hash: a.fromPromptTemplateHash,
          },
          to: {
            config_id: a.toConfigId,
            prompt_version: a.toPromptVersion,
            prompt_template_hash: a.toPromptTemplateHash,
          },
        }),
      ),
      counts: {
        contributions: entries.length,
        members: new Set(entries.map((e) => e.memberId)).size,
        counted: count("counted"),
        pending: count("pending"),
        pending_at_close: count("pending_at_close"),
        pending_reconciliation: count("pending_reconciliation"),
        excluded: count("excluded"),
      },
      totals: { point_units: total.toString(), points: exactPoints(total) },
      snapshot: epoch.snapshot
        ? {
            status: "frozen",
            closed_at: epoch.snapshot.closedAt,
            cutoff_assumption: epoch.snapshot.cutoffAssumption,
          }
        : { status: "not_frozen" },
    };
    return { body, facts: await publicationFacts(tx, epoch.row, community.firstPaidEpoch) };
  });
  if (!read) return null;
  const settlement = await settlementOf(read.facts, chain, deadlineMs);
  return {
    ...read.body,
    allocation: firstV1Section(settlement.allocation),
    payment: firstV1Section(settlement.payment),
    settlement,
  };
}

export async function readClaim(
  db: Db,
  mint: string,
  index: number,
  wallet: string,
  now: Date,
  chain?: SettlementReader,
  deadlineMs = CHAIN_DEADLINE_MS,
): Promise<ClaimV1 | null> {
  const facts = await readOnly(db, async (tx) => {
    const found = await findEpoch(tx, mint, index);
    return found ? publicationFacts(tx, found.epoch.row, found.community.firstPaidEpoch) : null;
  });
  const claim = facts && (await claimOf(facts, chain, wallet, deadlineMs));
  return claim ? { community: { mint }, ...claim, as_of: dateUs(now) } : null;
}

// Every leaf of `wallet` in a recorded publication of a served epoch, in any community, newest
// publication first. The page bounds the chain reads; they share one deadline.
export async function readWalletClaims(
  db: Db,
  wallet: string,
  page: { offset: number; limit: number },
  now: Date,
  chain?: SettlementReader,
  deadlineMs = CHAIN_DEADLINE_MS,
): Promise<WalletClaimsV1> {
  const { total, rows } = await readOnly(db, async (tx) => {
    const published = and(
      eq(leaves.wallet, wallet),
      isNotNull(epochs.publishTx),
      isNotNull(epochs.rewardConfigId),
      or(isNull(communities.firstPaidEpoch), gte(epochs.index, communities.firstPaidEpoch)),
    );
    const [counted] = await tx
      .select({ total: count() })
      .from(leaves)
      .innerJoin(epochs, eq(epochs.id, leaves.epochId))
      .innerJoin(communities, eq(communities.id, epochs.communityId))
      .innerJoin(epochPublications, eq(epochPublications.epochId, epochs.id))
      .where(published);
    const found = await tx
      .select({ mint: communities.mint, firstPaidEpoch: communities.firstPaidEpoch, epoch: epochs })
      .from(leaves)
      .innerJoin(epochs, eq(epochs.id, leaves.epochId))
      .innerJoin(communities, eq(communities.id, epochs.communityId))
      .innerJoin(epochPublications, eq(epochPublications.epochId, epochs.id))
      .where(published)
      .orderBy(desc(epochs.publishedAt), asc(communities.mint), desc(epochs.index))
      .offset(page.offset)
      .limit(page.limit);
    const rows: { mint: string; facts: PublicationFacts }[] = [];
    for (const r of found) {
      rows.push({ mint: r.mint, facts: await publicationFacts(tx, r.epoch, r.firstPaidEpoch) });
    }
    return { total: counted?.total ?? 0, rows };
  });
  const until = Date.now() + deadlineMs;
  const claims = await mapLimit(rows, LOOKUPS_AT_ONCE, async ({ mint, facts }) => {
    const claim = await walletClaimOf(facts, chain, wallet, until);
    // The leaves table is recorded from the stored intent, so a leaf missing from it is corrupt.
    if (!claim) throw new Error(`read: epoch ${facts.index} of ${mint} lacks a recorded leaf`);
    return { community: { mint }, ...claim };
  });
  return {
    wallet,
    as_of: dateUs(now),
    total_claims: Number(total),
    offset: page.offset,
    limit: page.limit,
    claims,
  };
}

export async function readContributions(
  db: Db,
  mint: string,
  index: number,
  page: Page,
  now: Date,
): Promise<ContributionsV1 | null> {
  return readOnly(db, async (tx) => {
    const found = await findEpoch(tx, mint, index);
    if (!found) return null;
    const { community, epoch } = found;
    const { total, entries } = await pageEntries(tx, epoch, page, now);
    return {
      community: { mint: community.mint },
      epoch: {
        index: epoch.row.index,
        closed: isClosed(epoch.row, now),
        final: epoch.snapshot !== null,
      },
      as_of: dateUs(now),
      total_contributions: total,
      offset: page.offset,
      limit: page.limit,
      contributions: await rows(tx, community, epoch, entries, now),
    };
  });
}

export async function readLeaderboard(
  db: Db,
  mint: string,
  index: number,
  page: Page,
  now: Date,
): Promise<LeaderboardV1 | null> {
  return readOnly(db, async (tx) => {
    const found = await findEpoch(tx, mint, index);
    if (!found) return null;
    const { community, epoch } = found;
    const entries = await epochEntries(tx, epoch, now);

    let totals: { memberId: string; units: bigint; whole: bigint }[];
    if (epoch.snapshot) {
      totals = (
        await tx
          .select({
            memberId: rewardSnapshotMembers.memberId,
            units: rewardSnapshotMembers.pointUnits,
            whole: rewardSnapshotMembers.wholePoints,
          })
          .from(rewardSnapshotMembers)
          .where(eq(rewardSnapshotMembers.snapshotId, epoch.snapshot.id))
      ).map((m) => ({ ...m }));
    } else {
      const { totals: live } = await selectEffective(tx, epoch.row.id, epoch.row.closesAt);
      totals = live.map((m) => ({
        memberId: m.memberId,
        units: BigInt(m.pointUnits),
        whole: BigInt(m.wholePoints),
      }));
    }
    totals.sort((a, b) =>
      a.units !== b.units ? (a.units > b.units ? -1 : 1) : a.memberId < b.memberId ? -1 : 1,
    );
    // Competition ranking over the sorted list: ties share the rank of their first position.
    const ranks: number[] = [];
    totals.forEach((m, i) => {
      const prev = totals[i - 1];
      ranks.push(prev && prev.units === m.units ? (ranks[i - 1] ?? i + 1) : i + 1);
    });
    const perMember = new Map<
      string,
      { contributions: number; counted: number; pending: number }
    >();
    for (const e of entries) {
      const c = perMember.get(e.memberId) ?? { contributions: 0, counted: 0, pending: 0 };
      c.contributions += 1;
      if (e.state === "counted") c.counted += 1;
      if (e.state === "pending") c.pending += 1;
      perMember.set(e.memberId, c);
    }
    const slice = totals.slice(page.offset, page.offset + page.limit);
    const sliceIds = slice.map((m) => m.memberId);
    const wallets = await publicWallets(tx, sliceIds, walletTime(epoch.row, now));
    const payouts = (await payoutsOf(tx, community, epoch, sliceIds, now)).members;
    return {
      community: { mint: community.mint },
      epoch: { index: epoch.row.index, opens_at: epoch.opensAt, closes_at: epoch.closesAt },
      closed: isClosed(epoch.row, now),
      final: epoch.snapshot !== null,
      as_of: dateUs(now),
      total_entries: totals.length,
      total_contributions: entries.length,
      offset: page.offset,
      limit: page.limit,
      entries: slice.map((m, i) => {
        const mine = perMember.get(m.memberId) ?? { contributions: 0, counted: 0, pending: 0 };
        if (m.whole !== wholePoints(m.units as PointUnits)) {
          throw new Error(`read: member ${m.memberId} whole points disagree with their units`);
        }
        return {
          rank: ranks[page.offset + i] ?? page.offset + i + 1,
          member_id: m.memberId,
          ...(wallets.get(m.memberId) ?? { wallet: null, wallet_status: "none" as const }),
          point_units: m.units.toString(),
          points: exactPoints(m.units),
          whole_points: m.whole.toString(),
          ...mine,
          payout: payoutOf(payouts, m.memberId),
        };
      }),
    };
  });
}

export async function readContribution(
  db: Db,
  contributionId: string,
  now: Date,
): Promise<ContributionV1 | null> {
  return readOnly(db, async (tx) => {
    const [intake] = await tx
      .select({
        id: rewardIntakes.id,
        epochId: rewardIntakes.epochId,
        configId: rewardIntakes.configId,
        communityId: rewardIntakes.communityId,
        memberId: rewardIntakes.memberId,
        capture: rewardIntakes.capture,
        reentryOf: rewardIntakes.reentryOf,
        acceptedAt: rewardIntakes.acceptedAt,
      })
      .from(rewardIntakes)
      .where(eq(rewardIntakes.contributionId, contributionId));
    if (!intake) return null;
    const [community] = await tx
      .select({ mint: communities.mint, firstPaidEpoch: communities.firstPaidEpoch })
      .from(communities)
      .where(eq(communities.id, intake.communityId));
    const [epochRow] = await tx
      .select({ index: epochs.index })
      .from(epochs)
      .where(and(eq(epochs.id, intake.epochId), isNotNull(epochs.rewardConfigId)));
    if (!community || !epochRow) return null;
    const [epoch] = await findEpochs(tx, intake.communityId, epochRow.index);
    if (!epoch) return null;

    const [intakeRow] = await tx
      .select(intakeColumns)
      .from(rewardIntakes)
      .where(eq(rewardIntakes.contributionId, contributionId));
    const [entry] = intakeRow
      ? withStates([intakeRow], await statesFor(tx, epoch, [contributionId], now))
      : [];
    if (!entry) throw new Error(`read: contribution ${contributionId} missing from its epoch`);
    const [row] = await rows(tx, community, epoch, [entry], now);
    if (!row) throw new Error("read: row");

    const [content] = await tx
      .select({ text: contributions.text })
      .from(contributions)
      .where(eq(contributions.id, contributionId));

    const lineage = (
      await tx
        .select({ d: rewardDecisions, acceptedAtUs: isoUs(rewardDecisions.acceptedAt) })
        .from(rewardDecisions)
        .where(eq(rewardDecisions.contributionId, contributionId))
        .orderBy(asc(rewardDecisions.revision))
    ).map((r): Decision => ({ ...r.d, acceptedAtUs: r.acceptedAtUs }));
    const cutoff = epoch.row.closesAt.getTime();
    const selected = lineage.findLast((d) => d.acceptedAt.getTime() < cutoff);
    if (epoch.snapshot && (row.selected?.revision ?? null) !== (selected?.revision ?? null)) {
      throw new Error(`read: contribution ${contributionId} disagrees with its snapshot`);
    }

    const dispatchIds = lineage.flatMap((d) => (d.dispatchId ? [d.dispatchId] : []));
    const dispatches = dispatchIds.length
      ? await tx
          .select({
            id: rewardDispatches.id,
            model: rewardDispatches.model,
            promptVersion: rewardDispatches.promptVersion,
            promptHash: rewardDispatches.promptHash,
            inputHash: rewardDispatches.inputHash,
            outputHash: rewardDispatches.outputHash,
            latencyMs: rewardDispatches.latencyMs,
            costMicroUsd: rewardDispatches.costMicroUsd,
          })
          .from(rewardDispatches)
          .where(inArray(rewardDispatches.id, dispatchIds))
      : [];
    const dispatchById = new Map(dispatches.map((d) => [d.id, d]));

    const revisions = lineage.map((d): RevisionV1 => {
      const flags = flagsOf(d);
      const dispatch = d.dispatchId ? dispatchById.get(d.dispatchId) : undefined;
      if (d.dispatchId && !dispatch?.outputHash) {
        throw new Error(`read: decision ${d.id} has no completed dispatch`);
      }
      return {
        revision: d.revision,
        status:
          d.acceptedAt.getTime() >= cutoff
            ? "late"
            : d.id === selected?.id
              ? "selected"
              : "superseded",
        accepted_at: d.acceptedAtUs,
        affects_allocation: d.affectsAllocation,
        source: d.correctionActor ? "correction" : "model",
        raw_quality: d.rawQuality,
        credited_quality: d.creditedQuality,
        credit_rule: creditRule(d.rawQuality, flags, d.creditedQuality),
        flags,
        effort: d.effort,
        effort_criteria: effortCriteriaRecord(d),
        timing_bps: d.timingBps,
        multiplier_bps: d.multiplierBps,
        point_units: d.pointUnits.toString(),
        points: exactPoints(d.pointUnits),
        explanation: d.explanation,
        model:
          dispatch && !d.correctionActor
            ? {
                model: dispatch.model,
                prompt_version: dispatch.promptVersion,
                prompt_hash: dispatch.promptHash,
                input_hash: dispatch.inputHash,
                output_hash: dispatch.outputHash ?? "",
                latency_ms: dispatch.latencyMs,
                cost_micro_usd: dispatch.costMicroUsd,
              }
            : null,
        correction: correctionRecord(d),
      };
    });

    const linkedContribution = async (where: SQL | undefined) => {
      const [r] = await tx
        .select({ contributionId: rewardIntakes.contributionId })
        .from(rewardIntakes)
        .where(where);
      return r?.contributionId ?? null;
    };
    const [nomination] = await tx
      .select({ kind: rewardNominations.kind, state: rewardNominations.state })
      .from(rewardNominations)
      .where(eq(rewardNominations.contributionId, contributionId))
      .orderBy(desc(rewardNominations.acceptedAt))
      .limit(1);
    const capture = intake.capture as {
      source: "x_oembed" | "telegram_text";
      capturedAt: string;
      limitations: string[];
    };
    // Two amendments can pin one config (the way back); the later one in effect at admission rules.
    const admittedUnder = (await amendmentsOf(tx, intake.epochId)).findLast(
      (a) =>
        a.row.toConfigId === intake.configId &&
        a.row.effectiveAt.getTime() <= intake.acceptedAt.getTime(),
    );

    return {
      ...row,
      community: { mint: community.mint },
      text: content?.text ?? "",
      capture: {
        source: capture.source,
        captured_at: dateUs(new Date(capture.capturedAt)),
        limitations: capture.limitations,
      },
      reentry_of: intake.reentryOf
        ? await linkedContribution(eq(rewardIntakes.id, intake.reentryOf))
        : null,
      reentered_as: await linkedContribution(eq(rewardIntakes.reentryOf, intake.id)),
      nomination: nomination ?? null,
      revisions,
      amendment: admittedUnder
        ? {
            effective_at: admittedUnder.effectiveAtUs,
            prompt_version: admittedUnder.row.toPromptVersion,
          }
        : null,
    };
  });
}
