import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDb, holdChecks, holdRulings } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluatePayoutGate, HOLD_WINDOW_MS } from "./gate.js";
import { type HoldChecker, runHoldChecks } from "./hold-gate.js";
import { recordHoldRulings } from "./hold-rulings.js";
import { seedReadyEpoch } from "./ready-seed.js";

// Review F2 (Codex, 2026-11-03): a hold ruling must never record a member as not payable while a
// hold run holds that member's check with a result read inside the window but not yet committed.
// The ruling waits for the run's row lock, then judges what it committed. Postgres 17 through
// postgres-js, the production driver, two connections (scripts/test-pg.sh).
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
// Both connections are named, uniquely per run, so the test can tell them apart in
// pg_stat_activity: postgres-js passes the URL parameter to Postgres as application_name.
const RUN = randomUUID();
const WRITER = `hold-rulings-writer-${RUN}`;
const RULER = `hold-rulings-ruler-${RUN}`;
const named = (name: string) => `${url}${url.includes("?") ? "&" : "?"}application_name=${name}`;
const writer = createDb(named(WRITER));
const ruler = createDb(named(RULER));

beforeAll(async () => {
  await migrate(writer, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([writer.$client.end(), ruler.$client.end()]);
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const RULING = { reason: "Helius outage: hold read lost", actor: "cisco" };

// Waits until Postgres reports the ruling's backend blocked by the hold run's backend: time alone
// proves nothing, since a query that starts after the run is released would also look late.
async function untilRulerBlockedByRun(db: typeof writer, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await db.$client`
      select r.pid from pg_stat_activity r
      where r.application_name = ${RULER}
        and exists (
          select 1 from pg_stat_activity h
          where h.application_name = ${WRITER} and h.pid = any(pg_blocking_pids(r.pid)))`;
    if (rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`the ruling was never blocked by the hold run within ${timeoutMs} ms`);
}

describe("recording hold rulings on Postgres", () => {
  it("waits for an in-flight holder result and rules only the reads still unread", async () => {
    const s = await seedReadyEpoch(writer, { now: NOW });
    const ref = { communityId: s.communityId, epochId: s.epochId };
    // floor's read is in flight; ordinary's never completes.
    for (const label of ["floor", "ordinary"] as const) {
      await writer
        .update(holdChecks)
        .set({
          status: "pending",
          rawAmount: null,
          decimals: null,
          provider: null,
          slot: null,
          observedAt: null,
        })
        .where(and(eq(holdChecks.epochId, s.epochId), eq(holdChecks.memberId, s.members[label])));
    }
    const inWindow = new Date(s.closesAt.getTime() + 60 * 60_000);
    const afterWindow = new Date(s.closesAt.getTime() + HOLD_WINDOW_MS + 60_000);

    // The barrier: floor's balance read has its answer but waits to be released, the run still
    // holding the row it claimed.
    let reading!: () => void;
    const started = new Promise<void>((resolve) => {
      reading = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const check: HoldChecker = async (input) => {
      if (input.owner !== s.wallets.floor) return { kind: "uncertain", reason: "outage" };
      reading();
      await released;
      return {
        kind: "holder",
        rawAmount: 150_000_000_000n,
        decimals: 6,
        provider: "consensus",
        slot: 412_345_678n,
        observedAt: new Date(s.closesAt.getTime() + 5 * 60_000),
      };
    };
    const run = runHoldChecks(writer, ref, { check, clock: () => inWindow });
    await started;

    let settled = false;
    const ruling = recordHoldRulings(ruler, {
      mint: s.mint,
      index: 1,
      now: afterWindow,
      ...RULING,
    }).finally(() => {
      settled = true;
    });
    // The ruling waits on floor's claimed row instead of judging it pending. Time alone proves
    // nothing (a query that starts after release() would also look settled late), so wait until
    // Postgres reports the ruling's backend blocked by the run's backend, then release the run.
    try {
      await untilRulerBlockedByRun(writer);
    } catch (error) {
      // Let the run and the ruling finish so a failed wait leaves nothing hanging.
      release();
      await Promise.allSettled([run, ruling]);
      throw error;
    }
    const waited = !settled;
    release();
    await run;
    expect(waited).toBe(true);

    const outcome = await ruling;
    expect(outcome).toMatchObject({ status: "recorded", count: 1 });
    if (outcome.status !== "recorded") throw new Error(outcome.status);
    expect(outcome.members.map((m) => m.memberId)).toEqual([s.members.ordinary]);
    const rulings = await writer
      .select({ memberId: holdRulings.memberId })
      .from(holdRulings)
      .where(eq(holdRulings.epochId, s.epochId));
    expect(rulings).toEqual([{ memberId: s.members.ordinary }]);

    const gate = await evaluatePayoutGate(writer, ref, { clock: () => afterWindow });
    expect(gate.members.find((m) => m.memberId === s.members.floor)).toMatchObject({
      status: "payable",
    });
    expect(gate.members.find((m) => m.memberId === s.members.ordinary)).toMatchObject({
      status: "not_payable",
      reasons: ["hold_unread_ruled"],
    });
  });
});
