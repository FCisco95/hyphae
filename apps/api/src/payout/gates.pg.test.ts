import { fileURLToPath } from "node:url";
import { communities, createDb, epochs, holdChecks, rulesTestPasses } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedAuditDemo } from "../http/demo-seed.js";
import { evaluatePayoutGate } from "./gate.js";
import { dueHoldChecks, type HoldChecker, type HoldResult, runHoldChecks } from "./hold-gate.js";
import { type RulesTest, recordPass } from "./rules-test.js";

// The payout gates on Postgres 17 through postgres-js, the production driver (scripts/test-pg.sh).
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const pools = Array.from({ length: 6 }, () => createDb(url));
const [a] = pools as [ReturnType<typeof createDb>];

beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all(pools.map((p) => p.$client.end()));
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const tests: RulesTest[] = [
  {
    id: "demo-rules-1",
    covers: [{ community: "DEMO", version: "1.2.0" }],
    study: "/rules",
    questions: [{ text: "?", options: ["a", "b"], answer: 0, why: "because" }],
  },
];
const holderAt = (observedAt: Date): HoldResult => ({
  kind: "holder",
  rawAmount: 18_446_744_073_709_551_615n, // u64 max: beyond bigint, stored as numeric
  decimals: 6,
  provider: "consensus",
  slot: 18_446_744_073_709_551_000n,
  observedAt,
});
const answer =
  (result: HoldResult): HoldChecker =>
  async () =>
    result;

async function candidate() {
  const demo = await seedAuditDemo(a, NOW);
  const [e1] = await a
    .select()
    .from(epochs)
    .where(and(eq(epochs.communityId, demo.communityId), eq(epochs.index, 1)));
  if (!e1) throw new Error("demo: epoch 1");
  await a
    .update(communities)
    .set({ firstPaidEpoch: 1 })
    .where(eq(communities.id, demo.communityId));
  await a.insert(rulesTestPasses).values({
    communityId: demo.communityId,
    memberId: demo.members.signed,
    testId: "demo-rules-1",
    passedAt: new Date(e1.closesAt.getTime() - 60_000),
  });
  // A balance read five minutes after the close, inside the 24-hour window.
  const holder = holderAt(new Date(e1.closesAt.getTime() + 5 * 60_000 + 123));
  // Fixture epochs close in the future of the real clock, so runs get a clock inside the window.
  const clock = () => new Date(e1.closesAt.getTime() + 60 * 60_000);
  return { demo, e1, holder, clock, ref: { communityId: demo.communityId, epochId: e1.id } };
}

describe("payout gates on Postgres", () => {
  it("hold, then release: an uncertain check holds the epoch and a confirmed one clears it", async () => {
    const { demo, e1, holder, clock, ref } = await candidate();
    expect((await evaluatePayoutGate(a, ref, { tests })).status).toBe("blocked");
    await runHoldChecks(a, ref, {
      check: answer({ kind: "uncertain", reason: "outage" }),
      tests,
      clock,
    });
    const hourAfter = new Date(e1.closesAt.getTime() + 3_600_000);
    expect((await dueHoldChecks(a, hourAfter)).filter((d) => d.epochId === ref.epochId)).toEqual([
      ref,
    ]);

    await runHoldChecks(a, ref, { check: answer(holder), tests, clock });
    const [row] = await a.select().from(holdChecks).where(eq(holdChecks.epochId, ref.epochId));
    expect(row).toMatchObject({
      status: "holder",
      rawAmount: "18446744073709551615",
      slot: "18446744073709551000",
      attempts: 2,
      observedAt: holder.kind === "holder" ? holder.observedAt : null,
    });
    const gate = await evaluatePayoutGate(a, ref, { tests });
    expect(gate).toMatchObject({ status: "ready", payable: 1 });
    expect(gate.members.find((m) => m.memberId === demo.members.signed)?.status).toBe("payable");
  });

  it("concurrent runs settle on one row, and a confirmed result is never overwritten", async () => {
    for (let round = 0; round < 5; round++) {
      const { holder, clock, ref } = await candidate();
      await Promise.all(
        pools.map((db, i) =>
          runHoldChecks(db, ref, {
            check: answer(i % 2 === 0 ? holder : { kind: "uncertain", reason: "conflict" }),
            tests,
            clock,
          }),
        ),
      );
      const rows = await a.select().from(holdChecks).where(eq(holdChecks.epochId, ref.epochId));
      expect(rows).toHaveLength(1);
      // Any run that answered holder may land it; after that no uncertain answer can undo it.
      await runHoldChecks(a, ref, { check: answer(holder), tests, clock });
      await runHoldChecks(a, ref, {
        check: answer({ kind: "uncertain", reason: "outage" }),
        tests,
        clock,
      });
      const [final] = await a.select().from(holdChecks).where(eq(holdChecks.epochId, ref.epochId));
      expect(final?.status).toBe("holder");
    }
  });

  it("concurrent runs read each balance once: one run claims the row, the others skip it", async () => {
    for (let round = 0; round < 5; round++) {
      const { holder, clock, ref } = await candidate();
      let calls = 0;
      const slowHolder: HoldChecker = async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 200));
        return holder;
      };
      await Promise.all(
        pools.map((db) => runHoldChecks(db, ref, { check: slowHolder, tests, clock })),
      );
      expect(calls).toBe(1);
      const rows = await a.select().from(holdChecks).where(eq(holdChecks.epochId, ref.epochId));
      expect(rows).toEqual([expect.objectContaining({ status: "holder", attempts: 1 })]);
    }
  });

  it("concurrent passes of one member keep one row and one time", async () => {
    const { demo } = await candidate();
    const input = {
      communityId: demo.communityId,
      memberId: demo.members.signed,
      testId: "mycel-rules-1",
    };
    const results = await Promise.all(pools.map((db) => recordPass(db, input)));
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.passedAt.getTime())).size).toBe(1);
  });
});
