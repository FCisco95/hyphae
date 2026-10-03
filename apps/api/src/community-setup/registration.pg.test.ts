import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "@hyphae/core";
import { communities, createDb, type Db, epochs } from "@hyphae/db";
import { getBase58Decoder } from "@solana/kit";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseSetupManifest, type SetupManifest, setupPlan } from "./manifest.js";
import { applyCommunitySetup, checkCommunitySetup } from "./registration.js";
import { manifest, telegramFor } from "./test-fixture.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use the disposable test:pg runner");
const a = createDb(url);
const b = createDb(url);
let seq = 0;
function fresh(): SetupManifest {
  seq += 1;
  return parseSetupManifest({
    ...manifest(`Setup${seq}`),
    communityId: randomUUID(),
    mint: getBase58Decoder().decode(randomBytes(32)),
    telegramChatId: String(-900_000_000 - seq),
    adminTelegramUserId: String(70_000 + seq),
  });
}
const apply = (db: Db, m: SetupManifest) =>
  applyCommunitySetup(db, m, setupPlan(m).hash, telegramFor(m));

beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([a.$client.end(), b.$client.end()]);
});

describe("community setup on two real Postgres pools", () => {
  it("serializes identical requests into one registration and one pinned epoch (five rounds)", async () => {
    for (let round = 0; round < 5; round += 1) {
      const m = fresh();
      const results = await Promise.all([apply(a, m), apply(b, m)]);
      expect(results.map((r) => r.status).sort()).toEqual(["created", "existing"]);
      expect(
        await a.select().from(communities).where(eq(communities.id, m.communityId)),
      ).toHaveLength(1);
      expect(
        await a.select().from(epochs).where(eq(epochs.communityId, m.communityId)),
      ).toHaveLength(1);
    }
  });

  it.each(["mint", "telegramChatId"] as const)(
    "refuses simultaneous conflicting %s bindings",
    async (key) => {
      const first = fresh();
      const other = { ...fresh(), [key]: first[key] };
      const results = await Promise.allSettled([apply(a, first), apply(b, other)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected");
      expect(rejected?.status === "rejected" && rejected.reason.code).toBe("registration_conflict");
      const found = await a
        .select()
        .from(communities)
        .where(
          key === "mint"
            ? eq(communities.mint, first.mint)
            : eq(communities.telegramChatId, BigInt(first.telegramChatId)),
        );
      expect(found).toHaveLength(1);
    },
  );

  it("reconciles lost COMMIT acknowledgement without adding a second community or epoch", async () => {
    const m = fresh();
    const uncertain = {
      transaction: async (fn: Parameters<typeof a.transaction>[0]) => {
        await a.transaction(fn);
        throw new Error("private lost acknowledgement");
      },
    } as unknown as Db;
    await expect(apply(uncertain, m)).rejects.toThrow("setup_outcome_unknown");
    expect(await checkCommunitySetup(b, m, telegramFor(m))).toMatchObject({ status: "existing" });
    expect(await apply(b, m)).toMatchObject({ status: "existing" });
    expect(await a.select().from(epochs).where(eq(epochs.communityId, m.communityId))).toHaveLength(
      1,
    );
  });

  it("rechecks activation against the database clock after a setup lock wait", async () => {
    const initial = fresh();
    const [time] = await a.execute(
      sql`select date_trunc('second', clock_timestamp()) + interval '2 seconds' as at`,
    );
    const m = { ...initial, activationTime: new Date(time?.at as Date).toISOString() };
    const key = BigInt.asIntN(
      64,
      BigInt(`0x${sha256Hex(`hyphae:setup:id:${m.communityId}`).slice(0, 16)}`),
    );
    let unlock!: () => void;
    const held = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    let locked!: () => void;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = a.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${key.toString()}::bigint)`);
      locked();
      await held;
    });
    await acquired;
    const refused = apply(b, m).then(
      () => null,
      (error: Error) => error.message,
    );
    try {
      await a.execute(
        sql`select pg_sleep(greatest(0, extract(epoch from (${m.activationTime}::timestamptz - clock_timestamp()))) + 0.02)`,
      );
    } finally {
      unlock();
      await holder;
    }
    expect(await refused).toBe("activation_not_future");
    expect(await a.select().from(communities).where(eq(communities.id, m.communityId))).toEqual([]);
  });
});
