import { randomUUID } from "node:crypto";
import { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GATE_READY_QUEUE_OPTIONS, queueGateReady } from "./gate-ready-notify.js";

// The dedupe the gate-ready message relies on, on the real queue: an epoch's message is accepted
// once, and is refused again after it completed and after a restart (a new PgBoss instance).
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const schema = `gate_ready_${randomUUID().slice(0, 8)}`;
const queue = "gate-ready";
const open = async () => {
  const boss = new PgBoss({ connectionString: url, schema });
  boss.on("error", () => {});
  await boss.start();
  await boss.createQueue(queue, GATE_READY_QUEUE_OPTIONS);
  return boss;
};
let boss: PgBoss;
beforeAll(async () => {
  boss = await open();
});
afterAll(async () => {
  await boss.stop({ graceful: false });
});

const note = {
  communityId: "c",
  epochId: randomUUID(),
  communityName: "n",
  mint: "M",
  epochIndex: 1,
  payable: 2,
  topUpLamports: 5n,
  adminTelegramUserId: 7n,
  outcome: "planned" as const,
};
const send = (b: PgBoss) => (job: object, opts: { id: string }) => b.send(queue, job, opts);

describe("gate-ready queue on Postgres", () => {
  it("accepts an epoch's message once, even after it completed and after a restart", async () => {
    expect(await queueGateReady([note], send(boss))).toBe(1);
    expect(await queueGateReady([note], send(boss))).toBe(0);

    const [job] = await boss.fetch(queue);
    expect(job).toBeDefined();
    await boss.complete(queue, (job as { id: string }).id);
    expect(await queueGateReady([note], send(boss))).toBe(0);

    await boss.stop({ graceful: false });
    boss = await open();
    expect(await queueGateReady([note], send(boss))).toBe(0);
    expect(await queueGateReady([{ ...note, epochId: randomUUID() }], send(boss))).toBe(1);
  });

  it("never runs a message twice: a handler that fails after Telegram accepted it is not retried", async () => {
    const failing = { ...note, epochId: randomUUID() };
    expect(await queueGateReady([failing], send(boss))).toBe(1);
    const [first] = await boss.fetch(queue);
    expect(first).toBeDefined();
    await boss.fail(queue, (first as { id: string }).id);
    // retryLimit 0: the failed job is terminal, so nothing is handed to a worker again, and the
    // epoch's id is still refused.
    expect(await boss.fetch(queue)).toEqual([]);
    expect(await queueGateReady([failing], send(boss))).toBe(0);
  });
});
