import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { communities, type Db, members, schema, tasks } from "@hyphae/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { bootstrapRewardEpochs, buildRewardConfigPayload, type Clock } from "./config.js";
import { admitContribution, type Capture } from "./intake.js";

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

export async function seedCommunity(db: Db) {
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

export async function seedTask(db: Db, communityId: string, opensAt: Date) {
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

export const T0 = new Date("2026-10-01T00:00:00.000Z");
export const later = (ms: number): Clock => at(new Date(T0.getTime() + ms));

let artifactSeq = 0;

// A community bootstrapped at T0 with one member, plus a helper that admits a post at T0 + 1 min.
export async function seedRewardLane(db: Db, payload = buildRewardConfigPayload(rubric)) {
  const { community, member } = await seedCommunity(db);
  await bootstrapRewardEpochs(
    db,
    { communityId: community.id, payload, opensAt: T0, proposedBy: "test" },
    { clock: later(-3_600_000) },
  );
  const admitOne = async (
    capture: Capture = { source: "x_oembed", capturedAt: T0.toISOString(), limitations: [] },
    memberId = member.id,
    clock: Clock = later(60_000),
  ) => {
    artifactSeq += 1;
    const result = await admitContribution(
      db,
      {
        communityId: community.id,
        memberId,
        contribution: {
          kind: "post",
          url: `https://x.com/a/status/${artifactSeq}`,
          text: `work ${artifactSeq}`,
          oembed: null,
          telegramMessageId: artifactSeq,
        },
        artifactKey: `x:status:${artifactSeq}`,
        idempotencyKey: `tg:-1:${artifactSeq}`,
        capture,
      },
      { clock },
    );
    if (result.status !== "admitted") throw new Error(`admit: ${result.status}`);
    return result.intake;
  };
  return { community, member, admitOne };
}
