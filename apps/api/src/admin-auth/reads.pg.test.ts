import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { communities, createDb } from "@hyphae/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rubric } from "../rewards/test-db.js";
import { operatorOverview } from "./reads.js";

// Job health on the real queue: the /ops groups plus this community's payout queues, and never
// another community's jobs. The production query names the `pgboss` schema, as the worker does.
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use the disposable test:pg runner");
const db = createDb(url);
const boss = new PgBoss({
  connectionString: url,
  schema: "pgboss",
  supervise: false,
  schedule: false,
});
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
  boss.on("error", () => {});
  await boss.start();
  for (const name of ["payout-settle", "gate-ready", "hold-check"]) await boss.createQueue(name);
});
afterAll(async () => {
  await boss.stop({ graceful: false });
  await db.$client.end();
});

async function community() {
  const suffix = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(communities)
    .values({
      mint: `OpsMint${suffix}`,
      name: `Ops ${suffix}`,
      telegramChatId: -BigInt(Date.now()) - BigInt(Math.floor(Math.random() * 1000)),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
      chainAddress: "CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2",
    })
    .returning();
  if (!row || row.chainAddress === null) throw new Error("seed");
  return { ...row, chainAddress: row.chainAddress };
}

describe("operator job health on Postgres", () => {
  it("counts this community's payout and reward jobs by queue and state, and no one else's", async () => {
    const mine = await community();
    const other = await community();
    await boss.send("payout-settle", { communityId: mine.id });
    await boss.send("gate-ready", { communityId: mine.id, epochId: randomUUID() });
    await boss.send("hold-check", { communityId: mine.id });
    await boss.send("payout-settle", { communityId: other.id });
    const body = await operatorOverview(db, mine, { network: "solana:devnet" });
    expect(body.jobs.status).toBe("available");
    if (body.jobs.status !== "available") return;
    const groups = Object.fromEntries(
      body.jobs.groups.map((g) => [`${g.name}:${g.state}`, g.count]),
    );
    expect(groups).toEqual({
      "payout-settle:created": 1,
      "gate-ready:created": 1,
      "hold-check:created": 1,
    });
  });
});
