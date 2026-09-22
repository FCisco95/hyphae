import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { communities, members, schema, tasks } from "@hyphae/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Clock } from "./config.js";

// In-process Postgres with the repo migrations applied; no network, no Neon.
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
  return { db, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];

export const at =
  (when: string | Date): Clock =>
  async () =>
    new Date(when);

export const rubric = {
  version: "1.2.0",
  community: "MYCEL",
  guidelines: "Add something real to the conversation. No price promises. Be specific.",
  criteria: [{ key: "context_fit", label: "Specific", weight: 1, description: "Reacts." }],
  timing: { fullUntil: 360, zeroAt: 2880 },
  stakeWeight: "none" as const,
  minHoldUnits: "100000000000",
  proposalAcceptThreshold: 70,
};

let seq = 0;

export async function seedCommunity(db: TestDb) {
  seq += 1;
  const [community] = await db
    .insert(communities)
    .values({
      mint: `Mint${seq}`,
      name: `Community ${seq}`,
      telegramChatId: BigInt(-1000 - seq),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("seed: community");
  const [member] = await db
    .insert(members)
    .values({
      communityId: community.id,
      telegramUserId: 42n,
      wallet: `Wallet${seq}`,
      linkMethod: "paste",
    })
    .returning();
  if (!member) throw new Error("seed: member");
  return { community, member };
}

export async function seedTask(db: TestDb, communityId: string, opensAt: Date) {
  const [task] = await db
    .insert(tasks)
    .values({
      communityId,
      kind: "raid",
      status: "open",
      targetUrl: "https://x.com/a/status/1",
      opensAt,
      closesAt: new Date(opensAt.getTime() + 48 * 3_600_000),
    })
    .returning();
  if (!task) throw new Error("seed: task");
  return task;
}
