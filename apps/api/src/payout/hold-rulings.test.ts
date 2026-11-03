import { HYPHAE_PROGRAM_ID } from "@hyphae/core";
import { holdChecks, holdRulings } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../rewards/test-db.js";
import { evaluatePayoutGate, HOLD_WINDOW_MS } from "./gate.js";
import { listUnreadHolds, recordHoldRulings } from "./hold-rulings.js";
import { buildPublication } from "./publication.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";

// Cisco's ruling of 2026-11-03 for MYCEL epoch 5: a member whose hold read never completed in the
// window (pending or uncertain after it) is not payable for that epoch, recorded member by member
// in hold_rulings. A member without a ruling stays held, so every other epoch behaves as before.

let db: TestDb;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => {
  await close();
});

const DAY = 86_400_000;
const RULING = { reason: "Helius outage: hold read lost", actor: "cisco" };

// An epoch 1 that closed three days ago, every hold read decided, so its window is over.
async function seed() {
  const s = await seedReadyEpoch(db, { now: new Date(Date.now() - 2 * DAY) });
  const ref = { communityId: s.communityId, epochId: s.epochId };
  const afterWindow = new Date(s.closesAt.getTime() + HOLD_WINDOW_MS + 60_000);
  return { ...s, ref, afterWindow };
}

// The read never completed: the check stays pending (or uncertain) with no observation.
async function unread(
  s: Awaited<ReturnType<typeof seed>>,
  label: "floor" | "ordinary",
  status: "pending" | "uncertain",
) {
  await db
    .update(holdChecks)
    .set({ status, rawAmount: null, decimals: null, provider: null, slot: null, observedAt: null })
    .where(and(eq(holdChecks.epochId, s.epochId), eq(holdChecks.memberId, s.members[label])));
}

const rule = (s: Awaited<ReturnType<typeof seed>>, label: "effort" | "floor" | "ordinary") =>
  db.insert(holdRulings).values({
    epochId: s.epochId,
    memberId: s.members[label],
    verdict: "not_payable",
    ...RULING,
  });

const verdictOf = (gate: Awaited<ReturnType<typeof evaluatePayoutGate>>, memberId: string) =>
  gate.members.find((m) => m.memberId === memberId);

describe("the payout gate with hold rulings", () => {
  it("keeps an unruled unread hold blocking the epoch, as before", async () => {
    const s = await seed();
    await unread(s, "floor", "pending");
    const gate = await evaluatePayoutGate(db, s.ref, { clock: () => s.afterWindow });
    expect(gate).toMatchObject({ status: "blocked", blockers: ["hold_checks_pending"] });
    expect(verdictOf(gate, s.members.floor)).toMatchObject({
      status: "held",
      reasons: ["hold_pending"],
    });
  });

  it("turns an epoch whose only unread holds are ruled into ready, those members not payable", async () => {
    const s = await seed();
    await unread(s, "floor", "pending");
    await unread(s, "ordinary", "uncertain");
    await rule(s, "floor");
    await rule(s, "ordinary");
    const gate = await evaluatePayoutGate(db, s.ref, { clock: () => s.afterWindow });
    expect(gate).toMatchObject({ status: "ready", payable: 1 });
    for (const label of ["floor", "ordinary"] as const) {
      expect(verdictOf(gate, s.members[label])).toMatchObject({
        status: "not_payable",
        reasons: ["hold_unread_ruled"],
        holdResult: null,
      });
    }
    expect(verdictOf(gate, s.members.effort)).toMatchObject({ status: "payable", reasons: [] });
  });

  it("applies no ruling before the window is over", async () => {
    const s = await seed();
    await unread(s, "floor", "pending");
    await rule(s, "floor");
    const inWindow = new Date(s.closesAt.getTime() + HOLD_WINDOW_MS - 60_000);
    const gate = await evaluatePayoutGate(db, s.ref, { clock: () => inWindow });
    expect(verdictOf(gate, s.members.floor)).toMatchObject({ status: "held" });
  });

  it("never lets a ruling override a holder or below observation", async () => {
    const s = await seed();
    await rule(s, "effort");
    await db
      .update(holdChecks)
      .set({ status: "below", rawAmount: "1" })
      .where(and(eq(holdChecks.epochId, s.epochId), eq(holdChecks.memberId, s.members.ordinary)));
    await rule(s, "ordinary");
    const gate = await evaluatePayoutGate(db, s.ref, { clock: () => s.afterWindow });
    expect(verdictOf(gate, s.members.effort)).toMatchObject({ status: "payable", reasons: [] });
    expect(verdictOf(gate, s.members.effort)?.holdResult?.check.status).toBe("holder");
    expect(verdictOf(gate, s.members.ordinary)).toMatchObject({
      status: "not_payable",
      reasons: ["below_hold"],
    });
  });

  it("leaves a holder read outside the window held, ruling or not", async () => {
    const s = await seed();
    await db
      .update(holdChecks)
      .set({ observedAt: new Date(s.closesAt.getTime() + HOLD_WINDOW_MS + 1_000) })
      .where(and(eq(holdChecks.epochId, s.epochId), eq(holdChecks.memberId, s.members.floor)));
    await rule(s, "floor");
    const gate = await evaluatePayoutGate(db, s.ref, { clock: () => s.afterWindow });
    expect(verdictOf(gate, s.members.floor)).toMatchObject({
      status: "held",
      reasons: ["hold_pending"],
    });
  });

  it("commits the same B7 and B9 bytes when a ruling names a member whose hold was read", async () => {
    const s = await seed();
    const settings = {
      network: "solana:devnet" as const,
      programId: HYPHAE_PROGRAM_ID,
      feeRecipient: randomAddress(),
      grossLamports: 100_000_000n,
    };
    const before = await buildPublication(db, s.ref, settings);
    await rule(s, "effort");
    await rule(s, "floor");
    const after = await buildPublication(db, s.ref, settings);
    expect(before.status).toBe("ready");
    expect(after).toEqual(before);
  });
});

describe("recording hold rulings", () => {
  it("lists the unread holds after the window and records nothing in a dry run", async () => {
    const s = await seed();
    await unread(s, "floor", "pending");
    await unread(s, "ordinary", "uncertain");
    const listed = await listUnreadHolds(db, { mint: s.mint, index: 1, now: s.afterWindow });
    expect(listed).toMatchObject({ status: "ok", epochId: s.epochId });
    if (listed.status !== "ok") return;
    expect(listed.members.map((m) => [m.memberId, m.holdStatus]).sort()).toEqual(
      [
        [s.members.floor, "pending"],
        [s.members.ordinary, "uncertain"],
      ].sort(),
    );
    expect(await db.select().from(holdRulings).where(eq(holdRulings.epochId, s.epochId))).toEqual(
      [],
    );
  });

  it("records one ruling per unread hold in one transaction, and the epoch becomes ready", async () => {
    const s = await seed();
    await unread(s, "floor", "pending");
    await unread(s, "ordinary", "uncertain");
    const out = await recordHoldRulings(db, {
      mint: s.mint,
      index: 1,
      now: s.afterWindow,
      ...RULING,
    });
    expect(out).toMatchObject({ status: "recorded", count: 2 });
    const rows = await db.select().from(holdRulings).where(eq(holdRulings.epochId, s.epochId));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.verdict === "not_payable" && r.actor === "cisco")).toBe(true);
    const gate = await evaluatePayoutGate(db, s.ref, { clock: () => s.afterWindow });
    expect(gate.status).toBe("ready");
    // Nothing is left to rule.
    expect(
      await recordHoldRulings(db, { mint: s.mint, index: 1, now: s.afterWindow, ...RULING }),
    ).toEqual({ status: "refused", reason: "nothing_to_rule" });
  });

  it("refuses before the hold window ends, and for an unknown epoch", async () => {
    const s = await seed();
    await unread(s, "floor", "pending");
    const inWindow = new Date(s.closesAt.getTime() + HOLD_WINDOW_MS - 60_000);
    expect(await listUnreadHolds(db, { mint: s.mint, index: 1, now: inWindow })).toEqual({
      status: "refused",
      reason: "window_open",
    });
    expect(
      await recordHoldRulings(db, { mint: s.mint, index: 1, now: inWindow, ...RULING }),
    ).toEqual({ status: "refused", reason: "window_open" });
    expect(await listUnreadHolds(db, { mint: s.mint, index: 9, now: s.afterWindow })).toEqual({
      status: "refused",
      reason: "no_epoch",
    });
    expect(await db.select().from(holdRulings).where(eq(holdRulings.epochId, s.epochId))).toEqual(
      [],
    );
  });

  it("refuses a blank reason or actor", async () => {
    const s = await seed();
    await unread(s, "floor", "pending");
    for (const blank of [
      { reason: " ", actor: "cisco" },
      { reason: "outage", actor: "" },
    ]) {
      await expect(
        recordHoldRulings(db, { mint: s.mint, index: 1, now: s.afterWindow, ...blank }),
      ).rejects.toThrow(/reason and actor/);
    }
  });

  it("is refused by the database for any verdict but not_payable, and twice for one member", async () => {
    const s = await seed();
    await expect(
      db.insert(holdRulings).values({
        epochId: s.epochId,
        memberId: s.members.floor,
        verdict: "payable",
        ...RULING,
      }),
    ).rejects.toThrow();
    await rule(s, "floor");
    await expect(rule(s, "floor")).rejects.toThrow();
  });
});
