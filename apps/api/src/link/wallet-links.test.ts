import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { members, memberWalletLinks, schema } from "@hyphae/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { walletAt } from "./wallet-links.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const OLD = "OldWallet1111111111111111111111111";
const NEW = "NewWallet1111111111111111111111111";

describe("walletAt", () => {
  it("returns the wallet valid at a past instant after a relink (O2, D3)", async () => {
    const { community } = await seedCommunity(t.db);
    const [m] = await t.db
      .insert(members)
      .values({ communityId: community.id, telegramUserId: 7n, wallet: NEW, linkMethod: "paste" })
      .returning();
    if (!m) throw new Error("seed: member");
    await t.db.insert(memberWalletLinks).values([
      {
        communityId: community.id,
        memberId: m.id,
        wallet: OLD,
        method: "paste",
        validFrom: new Date("2026-10-01T00:00:00Z"),
        validTo: new Date("2026-10-05T00:00:00Z"),
      },
      {
        communityId: community.id,
        memberId: m.id,
        wallet: NEW,
        method: "paste",
        validFrom: new Date("2026-10-05T00:00:00Z"),
      },
    ]);

    expect(await walletAt(t.db, m.id, new Date("2026-10-04T23:59:59Z"))).toEqual({
      wallet: OLD,
      method: "paste",
    });
    expect(await walletAt(t.db, m.id, new Date("2026-10-05T00:00:00Z"))).toEqual({
      wallet: NEW,
      method: "paste",
    });
    expect(await walletAt(t.db, m.id, new Date("2026-09-30T00:00:00Z"))).toBeUndefined();
  });

  it("the database allows one current wallet per member and a signature link only with its proof", async () => {
    const { community, member } = await seedCommunity(t.db);
    const row = { communityId: community.id, memberId: member.id, validFrom: new Date() };
    await t.db.insert(memberWalletLinks).values({ ...row, wallet: OLD, method: "paste" });

    await expect(
      t.db.insert(memberWalletLinks).values({ ...row, wallet: NEW, method: "paste" }),
    ).rejects.toThrow();
    await expect(
      t.db
        .insert(memberWalletLinks)
        .values({ ...row, wallet: NEW, method: "signature", validTo: new Date(Date.now() + 1) }),
    ).rejects.toThrow();
  });
});

describe("migration 0008 backfill", () => {
  it("gives every existing member its current wallet as an open history row", async () => {
    const full = fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url));
    const upTo7 = mkdtempSync(join(tmpdir(), "hyphae-0007-"));
    cpSync(full, upTo7, { recursive: true });
    const journalPath = join(upTo7, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 7);
    writeFileSync(journalPath, JSON.stringify(journal));
    const client = new PGlite();
    try {
      const db = drizzle(client, { schema });
      await migrate(db, { migrationsFolder: upTo7 });
      const { member } = await seedCommunity(db);

      await migrate(db, { migrationsFolder: full });
      const rows = await db.select().from(memberWalletLinks);
      expect(rows).toEqual([
        expect.objectContaining({
          memberId: member.id,
          wallet: member.wallet,
          method: "paste",
          proofRequestId: null,
          validTo: null,
        }),
      ]);
      expect(rows[0]?.validFrom.getTime()).toBe(Math.round(member.linkedAt.getTime()));
    } finally {
      await client.close();
      rmSync(upTo7, { recursive: true, force: true });
    }
  });
});
