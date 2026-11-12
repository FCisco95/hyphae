import { type CommunityStatsV1, HYPHAE_PROGRAM_ID } from "@hyphae/core";
import { type Db, members } from "@hyphae/db";
import { count, eq } from "drizzle-orm";
import { readOnly } from "../pg.js";
import {
  dateUs,
  epochTotals,
  findCommunity,
  findEpochs,
  publicationFacts,
  type ReadClock,
  timeIn,
} from "./read-service.js";
import {
  CHAIN_DEADLINE_MS,
  type PublicationFacts,
  publicationsOf,
  type SettlementReader,
} from "./settlement.js";

// A community's totals. Counts are the database's; every SOL figure is the chain's, read through
// the epoch accounts alone (see publicationsOf), so a page of members never costs a page of RPC
// calls. Nothing here names a member, a handle or a wallet.

export async function readStats(
  db: Db,
  mint: string,
  clock: ReadClock,
  chain?: SettlementReader,
  deadlineMs = CHAIN_DEADLINE_MS,
): Promise<CommunityStatsV1 | null> {
  const until = Date.now() + deadlineMs;
  const read = await readOnly(db, async (tx) => {
    const now = await timeIn(tx, clock);
    const community = await findCommunity(tx, mint);
    if (!community) return null;
    const served = await findEpochs(tx, community.id);
    const [registered] = await tx
      .select({ n: count() })
      .from(members)
      .where(eq(members.communityId, community.id));
    const scored = new Set<string>();
    const facts: PublicationFacts[] = [];
    for (const epoch of served) {
      for (const m of await epochTotals(tx, epoch)) if (m.units > 0n) scored.add(m.memberId);
    }
    // Oldest first. An epoch before the first paid epoch is retained, not a publication.
    for (const epoch of [...served].reverse()) {
      const first = community.firstPaidEpoch;
      if (epoch.row.publishTx === null || (first !== null && epoch.row.index < first)) continue;
      facts.push(await publicationFacts(tx, epoch.row, first));
    }
    return {
      mint: community.mint,
      now,
      registered: Number(registered?.n ?? 0),
      scored: scored.size,
      served: served.length,
      facts,
    };
  });
  if (!read) return null;
  const found = await publicationsOf(read.facts, chain, until);
  return {
    community: { mint: read.mint },
    as_of: dateUs(read.now),
    members: { registered: read.registered, ever_scored: read.scored },
    epochs: { served: read.served },
    payouts: "status" in found ? found : payoutsOf(found),
  };
}

type Found = Exclude<Awaited<ReturnType<typeof publicationsOf>>, { status: "unavailable" }>;

function payoutsOf(found: Found): CommunityStatsV1["payouts"] {
  let gross = 0n;
  let fee = 0n;
  let allocated = 0n;
  let claimed = 0n;
  for (const { verified: v } of found) {
    const s = v.intent.settlement;
    gross += BigInt(s.gross_lamports);
    fee += BigInt(s.fee_lamports);
    allocated += BigInt(s.allocated_lamports);
    claimed += v.claimed;
  }
  return {
    status: "available",
    network: found[0]?.verified.intent.network ?? null,
    program_id: HYPHAE_PROGRAM_ID,
    epochs_paid: found.length,
    gross_lamports: gross.toString(),
    fee_lamports: fee.toString(),
    allocated_lamports: allocated.toString(),
    claimed_lamports: claimed.toString(),
    unclaimed_lamports: (allocated - claimed).toString(),
    publications: found.map(({ index, verified: v }) => ({
      index,
      epoch_address: v.epoch,
      publish_tx: v.publishTx,
      published_at: v.publishedAt,
      root: v.intent.root,
      allocated_lamports: v.intent.settlement.allocated_lamports,
      claimed_lamports: v.claimed.toString(),
    })),
  };
}

// The same answer for a short while, so the chain is read at most once per community per window
// however many readers ask: the free RPC tier's limits broke an epoch's payout once. Only an
// answer is kept, never an unknown mint, and a failed read is not kept at all.
export function cachedStats(ttlMs = 30_000, capacity = 100) {
  const kept = new Map<string, { until: number; value: Promise<CommunityStatsV1 | null> }>();
  return (
    db: Db,
    mint: string,
    clock: ReadClock,
    chain?: SettlementReader,
  ): Promise<CommunityStatsV1 | null> => {
    const hit = kept.get(mint);
    if (hit && hit.until > Date.now()) return hit.value;
    const value = readStats(db, mint, clock, chain);
    if (ttlMs <= 0) return value;
    kept.set(mint, { until: Date.now() + ttlMs, value });
    if (kept.size > capacity) kept.delete(kept.keys().next().value as string);
    const forget = () => {
      if (kept.get(mint)?.value === value) kept.delete(mint);
    };
    value.then((body) => body === null && forget(), forget);
    return value;
  };
}
