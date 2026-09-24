import { randomUUID } from "node:crypto";
import { communities, type Db, epochs, holdChecks, rewardEpochSnapshots } from "@hyphae/db";
import {
  checkHold,
  FallbackBalanceReader,
  HeliusBalanceReader,
  parseProjectId,
  parseWalletAddress,
} from "@organichub/verify";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { type Blocker, evaluatePayoutGate } from "./gate.js";
import type { RulesTest } from "./rules-test.js";

// The hold gate (P9, P16; Sentinel consumer guide §6): one logical check per candidate member and
// paid epoch, recorded in hold_checks. holder and below are final; uncertain is retried under the
// same checkRound and is never treated as below.
export type HoldResult =
  | Awaited<ReturnType<typeof checkHold>>
  | { kind: "uncertain"; reason: "not_configured" };

export type HoldChecker = (input: {
  projectId: string;
  owner: string;
  mint: string;
  thresholdRaw: bigint;
  checkRound: string;
}) => Promise<HoldResult>;

// Built once per process. Without both providers, or with one the SDK refuses to construct, every
// check is uncertain and makes no request. Nothing here logs or returns a provider URL.
export function holdCheckerFromEnv(
  env: { HOLD_RPC_HELIUS_URL?: string | undefined; HOLD_RPC_FALLBACK_URL?: string | undefined },
  fetchImpl?: typeof fetch,
): HoldChecker {
  let readers: { primary: HeliusBalanceReader; fallback: FallbackBalanceReader } | undefined;
  if (env.HOLD_RPC_HELIUS_URL && env.HOLD_RPC_FALLBACK_URL) {
    const options = (rpcUrl: string) => ({ rpcUrl, ...(fetchImpl && { fetch: fetchImpl }) });
    try {
      readers = {
        primary: new HeliusBalanceReader(options(env.HOLD_RPC_HELIUS_URL)),
        fallback: new FallbackBalanceReader(options(env.HOLD_RPC_FALLBACK_URL)),
      };
    } catch {
      readers = undefined;
    }
  }
  return async (input) => {
    if (!readers) return { kind: "uncertain", reason: "not_configured" };
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
  deps: { check: HoldChecker; tests?: readonly RulesTest[] },
): Promise<
  | { status: "skipped"; blockers: Blocker[] }
  | { status: "checked"; holder: number; below: number; uncertain: number }
> {
  const gate = await evaluatePayoutGate(db, ref, deps.tests ? { tests: deps.tests } : {});
  if (gate.status === "blocked" && gate.blockers.some((b) => STRUCTURAL.has(b))) {
    return { status: "skipped", blockers: gate.blockers };
  }
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

// Retried until confirmed; an epoch with no check yet is looked at for 7 days after its close,
// which covers a lost close-hook job and a first paid epoch recorded shortly after a close.
const FIRST_CHECK_WINDOW = "7 days";

export async function dueHoldChecks(
  db: Db,
  now: Date,
): Promise<{ communityId: string; epochId: string }[]> {
  return db
    .select({ communityId: epochs.communityId, epochId: epochs.id })
    .from(epochs)
    .innerJoin(communities, eq(communities.id, epochs.communityId))
    .innerJoin(rewardEpochSnapshots, eq(rewardEpochSnapshots.epochId, epochs.id))
    .where(
      and(
        eq(epochs.status, "closed"),
        gte(epochs.index, communities.firstPaidEpoch),
        sql`(exists (select 1 from ${holdChecks} where ${holdChecks.epochId} = ${epochs.id} and ${holdChecks.status} in ('pending', 'uncertain'))
          or (not exists (select 1 from ${holdChecks} where ${holdChecks.epochId} = ${epochs.id})
              and ${rewardEpochSnapshots.closedAt} > ${now}::timestamptz - ${FIRST_CHECK_WINDOW}::interval))`,
      ),
    )
    .orderBy(asc(epochs.closesAt));
}
