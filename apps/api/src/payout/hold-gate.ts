import { randomUUID } from "node:crypto";
import { communities, type Db, epochs, holdChecks, rewardEpochSnapshots } from "@hyphae/db";
import {
  checkHold,
  FallbackBalanceReader,
  HeliusBalanceReader,
  parseProjectId,
  parseWalletAddress,
} from "@organichub/verify";
import { and, asc, eq, exists, gt, gte, inArray, notExists, or, sql } from "drizzle-orm";
import { type Blocker, evaluatePayoutGate, HOLD_WINDOW_MS } from "./gate.js";
import type { RulesTest } from "./rules-test.js";

// The hold gate (P9, P16; Sentinel consumer guide §6): one logical check per candidate member and
// paid epoch, recorded in hold_checks. holder and below are final; uncertain is retried under the
// same checkRound and is never treated as below.
export type HoldResult =
  | Awaited<ReturnType<typeof checkHold>>
  | { kind: "uncertain"; reason: "not_configured" | "wrong_network" };

export type HoldChecker = (input: {
  projectId: string;
  owner: string;
  mint: string;
  thresholdRaw: bigint;
  checkRound: string;
}) => Promise<HoldResult>;

// MYCEL is a mainnet token. checkHold takes no chain and does not attest one (guide §6), so each
// provider must prove it serves mainnet before any balance it reads is believed.
const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

// true: mainnet; false: another network; undefined: no usable answer.
async function servesMainnet(
  rpcUrl: string,
  fetchImpl: typeof fetch,
): Promise<boolean | undefined> {
  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash" }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return undefined;
    const { result } = (await response.json()) as { result?: unknown };
    return typeof result === "string" ? result === MAINNET_GENESIS : undefined;
  } catch {
    return undefined;
  }
}

// Built once per process. Without both providers, or with one the SDK refuses to construct, every
// check is uncertain and makes no request. Nothing here logs or returns a provider URL.
export function holdCheckerFromEnv(
  env: { HOLD_RPC_HELIUS_URL?: string | undefined; HOLD_RPC_FALLBACK_URL?: string | undefined },
  fetchImpl: typeof fetch = fetch,
): HoldChecker {
  const urls = [env.HOLD_RPC_HELIUS_URL, env.HOLD_RPC_FALLBACK_URL];
  let readers: { primary: HeliusBalanceReader; fallback: FallbackBalanceReader } | undefined;
  if (env.HOLD_RPC_HELIUS_URL && env.HOLD_RPC_FALLBACK_URL) {
    const options = (rpcUrl: string) => ({ rpcUrl, fetch: fetchImpl });
    try {
      readers = {
        primary: new HeliusBalanceReader(options(env.HOLD_RPC_HELIUS_URL)),
        fallback: new FallbackBalanceReader(options(env.HOLD_RPC_FALLBACK_URL)),
      };
    } catch {
      readers = undefined;
    }
  }
  // The endpoints are fixed for the process, so one confirmation holds; a failure is asked again.
  let onMainnet = false;
  return async (input) => {
    if (!readers) return { kind: "uncertain", reason: "not_configured" };
    if (!onMainnet) {
      const networks = await Promise.all(urls.map((url) => servesMainnet(url ?? "", fetchImpl)));
      if (networks.includes(false)) return { kind: "uncertain", reason: "wrong_network" };
      if (networks.includes(undefined)) return { kind: "uncertain", reason: "outage" };
      onMainnet = true;
    }
    try {
      return await checkHold({
        projectId: parseProjectId(input.projectId),
        owner: parseWalletAddress(input.owner),
        mint: parseWalletAddress(input.mint),
        thresholdRaw: input.thresholdRaw,
        checkRound: input.checkRound,
        ...readers,
      });
    } catch {
      // An address that does not parse, or any other rejection: undecided, and no error text
      // (which could carry provider details) leaves this function.
      return { kind: "uncertain", reason: "invalid-response" };
    }
  };
}

// The gate stops before the member stage for these, so there is no candidate to check.
const STRUCTURAL: ReadonlySet<Blocker> = new Set([
  "legacy_epoch",
  "already_published",
  "not_final",
  "before_first_paid_epoch",
  "no_rules_test_defined",
  "snapshot_mismatch",
]);

export async function runHoldChecks(
  db: Db,
  ref: { communityId: string; epochId: string },
  deps: { check: HoldChecker; tests?: readonly RulesTest[]; clock?: () => Date },
): Promise<
  | { status: "skipped"; blockers: Blocker[] }
  | { status: "window_closed" }
  | { status: "checked"; holder: number; below: number; uncertain: number }
> {
  const gate = await evaluatePayoutGate(db, ref, deps.tests ? { tests: deps.tests } : {});
  if (gate.status === "blocked" && gate.blockers.some((b) => STRUCTURAL.has(b))) {
    return { status: "skipped", blockers: gate.blockers };
  }
  // A balance read after the window could not count, so none is read.
  const now = (deps.clock ?? (() => new Date()))();
  if (now.getTime() > gate.closesAt.getTime() + HOLD_WINDOW_MS) return { status: "window_closed" };
  const counts = { holder: 0, below: 0, uncertain: 0 };
  const held = gate.members.filter((m) => m.status === "held");
  if (held.length === 0 || !gate.hold) return { status: "checked", ...counts };
  const { mint, thresholdRaw } = gate.hold;

  // The first insert fixes the checkRound; every retry of this logical check reuses it.
  await db
    .insert(holdChecks)
    .values(
      held.map((m) => ({
        communityId: ref.communityId,
        epochId: ref.epochId,
        memberId: m.memberId,
        wallet: m.wallet ?? "",
        mint,
        thresholdRaw: thresholdRaw.toString(),
        checkRound: randomUUID(),
      })),
    )
    .onConflictDoNothing({ target: [holdChecks.epochId, holdChecks.memberId] });
  const rows = await db
    .select()
    .from(holdChecks)
    .where(
      and(
        eq(holdChecks.epochId, ref.epochId),
        inArray(
          holdChecks.memberId,
          held.map((m) => m.memberId),
        ),
      ),
    );
  // Wallet history, mints and pinned thresholds never change, so a stored check for other terms
  // is a bug: refuse loudly rather than leave the member held for ever.
  for (const row of rows) {
    const member = held.find((m) => m.memberId === row.memberId);
    if (
      row.wallet !== member?.wallet ||
      row.mint !== mint ||
      BigInt(row.thresholdRaw) !== thresholdRaw
    ) {
      throw new Error(`payout: the hold check for member ${row.memberId} does not match its epoch`);
    }
  }

  for (const row of rows.filter((r) => r.status === "pending" || r.status === "uncertain")) {
    const result = await deps.check({
      projectId: ref.communityId,
      owner: row.wallet,
      mint: row.mint,
      thresholdRaw,
      checkRound: row.checkRound,
    });
    const attempt = {
      attempts: sql`${holdChecks.attempts} + 1`,
      checkedAt: sql`clock_timestamp()`,
    };
    // Only an open row changes, so a confirmed result from a racing run is never overwritten.
    const applied = await db
      .update(holdChecks)
      .set(
        result.kind === "uncertain"
          ? { ...attempt, status: "uncertain", reason: result.reason }
          : {
              ...attempt,
              status: result.kind,
              reason: null,
              rawAmount: result.rawAmount.toString(),
              decimals: result.decimals,
              provider: result.provider,
              slot: result.slot.toString(),
              observedAt: result.observedAt,
            },
      )
      .where(and(eq(holdChecks.id, row.id), inArray(holdChecks.status, ["pending", "uncertain"])))
      .returning({ id: holdChecks.id });
    if (applied.length > 0) counts[result.kind] += 1;
  }
  return { status: "checked", ...counts };
}

// Closed paid epochs inside the hold window whose candidates are not all confirmed yet, or that
// were never checked (a lost close-hook job, or a first paid epoch recorded after the close).
export async function dueHoldChecks(
  db: Db,
  now: Date,
): Promise<{ communityId: string; epochId: string }[]> {
  const ofEpoch = eq(holdChecks.epochId, epochs.id);
  return db
    .select({ communityId: epochs.communityId, epochId: epochs.id })
    .from(epochs)
    .innerJoin(communities, eq(communities.id, epochs.communityId))
    .innerJoin(rewardEpochSnapshots, eq(rewardEpochSnapshots.epochId, epochs.id))
    .where(
      and(
        eq(epochs.status, "closed"),
        gte(epochs.index, communities.firstPaidEpoch),
        gt(epochs.closesAt, new Date(now.getTime() - HOLD_WINDOW_MS)),
        or(
          exists(
            db
              .select({ id: holdChecks.id })
              .from(holdChecks)
              .where(and(ofEpoch, inArray(holdChecks.status, ["pending", "uncertain"]))),
          ),
          notExists(db.select({ id: holdChecks.id }).from(holdChecks).where(ofEpoch)),
        ),
      ),
    )
    .orderBy(asc(epochs.closesAt));
}
