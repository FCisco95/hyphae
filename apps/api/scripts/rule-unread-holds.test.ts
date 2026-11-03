import { holdChecks, holdRulings } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HOLD_WINDOW_MS } from "../src/payout/gate.js";
import { seedReadyEpoch } from "../src/payout/ready-seed.js";
import { createTestDb, type TestDb } from "../src/rewards/test-db.js";
import { parseRuleArgs, ruleUnreadHolds } from "./rule-unread-holds.js";

let db: TestDb;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => {
  await close();
});

const DAY = 86_400_000;

async function seedUnread() {
  const s = await seedReadyEpoch(db, { now: new Date(Date.now() - 2 * DAY) });
  await db
    .update(holdChecks)
    .set({
      status: "uncertain",
      reason: "provider timeout",
      rawAmount: null,
      decimals: null,
      provider: null,
      slot: null,
      observedAt: null,
    })
    .where(and(eq(holdChecks.epochId, s.epochId), eq(holdChecks.memberId, s.members.floor)));
  return { ...s, now: new Date(s.closesAt.getTime() + HOLD_WINDOW_MS + 60_000) };
}

const argv = (mint: string) => [
  "--mint",
  mint,
  "--epoch",
  "1",
  "--reason",
  "Helius outage: hold read lost",
  "--actor",
  "cisco",
];

describe("rule-unread-holds", () => {
  it("lists the unread holds in a dry run and writes nothing", async () => {
    const s = await seedUnread();
    const log: string[] = [];
    const out = await ruleUnreadHolds(argv(s.mint), { db, now: s.now, log: (l) => log.push(l) });
    expect(out).toMatchObject({ status: "ok", members: [{ memberId: s.members.floor }] });
    const text = log.join("\n");
    expect(text).toContain(s.members.floor);
    expect(text).toContain("hold uncertain (provider timeout)");
    expect(text).toContain("dry run");
    expect(await db.select().from(holdRulings).where(eq(holdRulings.epochId, s.epochId))).toEqual(
      [],
    );
  });

  it("records one ruling per listed member with --apply", async () => {
    const s = await seedUnread();
    const out = await ruleUnreadHolds([...argv(s.mint), "--apply"], {
      db,
      now: s.now,
      log: () => {},
    });
    expect(out).toMatchObject({ status: "recorded", count: 1 });
    expect(
      await db
        .select({
          memberId: holdRulings.memberId,
          reason: holdRulings.reason,
          actor: holdRulings.actor,
        })
        .from(holdRulings)
        .where(eq(holdRulings.epochId, s.epochId)),
    ).toEqual([
      { memberId: s.members.floor, reason: "Helius outage: hold read lost", actor: "cisco" },
    ]);
  });

  it("refuses before the window ends", async () => {
    const s = await seedUnread();
    const early = new Date(s.closesAt.getTime() + HOLD_WINDOW_MS - 60_000);
    const out = await ruleUnreadHolds([...argv(s.mint), "--apply"], {
      db,
      now: early,
      log: () => {},
    });
    expect(out).toEqual({ status: "refused", reason: "window_open" });
    expect(await db.select().from(holdRulings).where(eq(holdRulings.epochId, s.epochId))).toEqual(
      [],
    );
  });

  it.each([
    [
      "no reason",
      ["--mint", "So11111111111111111111111111111111111111112", "--epoch", "5", "--actor", "cisco"],
    ],
    [
      "a blank actor",
      [
        "--mint",
        "So11111111111111111111111111111111111111112",
        "--epoch",
        "5",
        "--reason",
        "x",
        "--actor",
        " ",
      ],
    ],
    [
      "a zero epoch",
      [
        "--mint",
        "So11111111111111111111111111111111111111112",
        "--epoch",
        "0",
        "--reason",
        "x",
        "--actor",
        "c",
      ],
    ],
    ["a bad mint", ["--mint", "0OIl", "--epoch", "5", "--reason", "x", "--actor", "c"]],
  ])("refuses %s", (_what, args) => {
    expect(() => parseRuleArgs(args)).toThrow();
  });
});
