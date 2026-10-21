import { randomUUID } from "node:crypto";
import { communities, type Db, epochs, holdChecks, rewardEpochSnapshots } from "@hyphae/db";
import {
  checkHold,
  FallbackBalanceReader,
  HeliusBalanceReader,
  parseProjectId,
  parseWalletAddress,
} from "@organichub/verify";
import { and, asc, eq, exists, gte, inArray, notExists, or, sql } from "drizzle-orm";
import { type Blocker, evaluatePayoutGate, HOLD_WINDOW_MS } from "./gate.js";
import type { RulesTest } from "./rules-test.js";

// The hold gate (P9, P16; Sentinel consumer guide §6): one logical check per candidate member and
// paid epoch, recorded in hold_checks. holder and below are final; uncertain is retried under the
// same checkRound and is never treated as below.
export type HoldResult =
  | Awaited<ReturnType<typeof checkHold>>
  | { kind: "uncertain"; reason: "not_configured" | "wrong_network" | "window_closed" };

export type HoldChecker = (input: {
  projectId: string;
  owner: string;
  mint: string;
  thresholdRaw: bigint;
  checkRound: string;
  // Epoch milliseconds after which no balance read may start.
  deadline?: number;
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
    // Only a clean answer to this request counts: it is cached for the life of the process.
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
    const reply = body as Record<string, unknown>;
    if (reply.jsonrpc !== "2.0" || reply.id !== 1 || "error" in reply) return undefined;
    return typeof reply.result === "string" ? reply.result === MAINNET_GENESIS : undefined;
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
    // The genesis check can take seconds. The SDK's own two reads (and their one retry each,
    // bounded at 4 s) cannot be interrupted, and a late answer is kept undecided by the runner.
    if (input.deadline !== undefined && Date.now() > input.deadline) {
      return { kind: "uncertain", reason: "window_closed" };
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
  | { status: "too_early" }
  | { status: "window_closed" }
  | { status: "checked"; holder: number; below: number; uncertain: number }
> {
  const gate = await evaluatePayoutGate(db, ref, deps.tests ? { tests: deps.tests } : {});
  if (gate.status === "blocked" && gate.blockers.some((b) => STRUCTURAL.has(b))) {
    return { status: "skipped", blockers: gate.blockers };
  }
  // A balance read outside [closesAt, closesAt + window] could not count, so none is started.
  const clock = deps.clock ?? (() => new Date());
  const closesAt = gate.closesAt.getTime();
  const deadline = closesAt + HOLD_WINDOW_MS;
  const started = clock().getTime();
  if (started < closesAt) return { status: "too_early" };
  if (started > deadline) return { status: "window_closed" };
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
    if (clock().getTime() > deadline) break;
    // One run reads a balance at a time: the row stays claimed for the read and its write, a
    // concurrent run skips it, and a crashed run's claim ends with its transaction.
    const recorded = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .select({ id: holdChecks.id })
        .from(holdChecks)
        .where(and(eq(holdChecks.id, row.id), inArray(holdChecks.status, ["pending", "uncertain"])))
        .for("update", { skipLocked: true });
      // Getting a connection and the claim can take time: the window is checked again here.
      if (!claimed || clock().getTime() > deadline) return undefined;
      const answer = await deps.check({
        projectId: ref.communityId,
        owner: row.wallet,
        mint: row.mint,
        thresholdRaw,
        checkRound: row.checkRound,
        deadline,
      });
      // An answer from outside the window cannot count, so it is kept undecided, never final.
      const observed = answer.kind === "uncertain" ? undefined : answer.observedAt.getTime();
      const result: HoldResult | { kind: "uncertain"; reason: "window_closed" | "before_close" } =
        clock().getTime() > deadline || (observed !== undefined && observed > deadline)
          ? { kind: "uncertain", reason: "window_closed" }
          : observed !== undefined && observed < closesAt
            ? { kind: "uncertain", reason: "before_close" }
            : answer;
      const attempt = {
        attempts: sql`${holdChecks.attempts} + 1`,
        checkedAt: sql`clock_timestamp()`,
      };
      await tx
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
        .where(eq(holdChecks.id, row.id));
      return result.kind;
    });
    if (recorded) counts[recorded] += 1;
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
        gte(epochs.closesAt, new Date(now.getTime() - HOLD_WINDOW_MS)),
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
