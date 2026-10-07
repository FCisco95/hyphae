import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { communities, createDb, members, memberWalletLinks } from "@hyphae/db";
import { consumeWalletProof, createVerificationRequest, parseProjectId } from "@organichub/verify";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openLinkSession, resolveLinkSession } from "../link/session.js";
import { createLinkStore } from "../link/store.js";
import { testTenant as tenant, testWallet } from "../link/test-wallet.js";
import { rubric } from "../rewards/test-db.js";
import { ensureMember } from "./ensure-member.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use disposable test:pg runner");
const a = createDb(url);
const b = createDb(url);
beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all([a.$client.end(), b.$client.end()]);
});

async function community() {
  const [row] = await a
    .insert(communities)
    .values({
      mint: `Earn${randomUUID()}`,
      name: "Earn first",
      telegramChatId: -BigInt(`7${Date.now()}${Math.floor(Math.random() * 1000)}`),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!row) throw new Error("community");
  return row;
}

describe("earn first on real Postgres", () => {
  it("two first submissions at once make one member", async () => {
    const c = await community();
    const input = { communityId: c.id, telegramUserId: 610n, telegramUsername: null };
    const [x, y] = await Promise.all([ensureMember(a, input), ensureMember(b, input)]);
    expect(x.id).toBe(y.id);
  });

  it("a wallet link racing a first submission links that member instead of refusing", async () => {
    const c = await community();
    const userId = 611n;
    const token = await openLinkSession(a, {
      communityId: c.id,
      telegramUserId: userId,
      telegramUsername: "u",
    });
    const found = await resolveLinkSession(a, token);
    if (!found) throw new Error("session");
    const { store, refusal } = createLinkStore(a, {
      communityId: c.id,
      linkSessionId: found.session.id,
      telegramUserId: userId,
      telegramUsername: "u",
      tenant,
    });
    const identity = { projectId: parseProjectId(c.id), userId: String(userId) };
    const w = await testWallet();
    const req = await createVerificationRequest(store, identity, w.address, tenant);

    // The first submission's insert holds the (community, user) key, uncommitted, while the link
    // transaction runs; the link must wait for it, then link that row.
    let release: () => void = () => {};
    const held = new Promise<void>((r) => {
      release = r;
    });
    let inserted: () => void = () => {};
    const insertedSignal = new Promise<void>((r) => {
      inserted = r;
    });
    const submission = b.transaction(async (tx) => {
      await ensureMember(tx, { communityId: c.id, telegramUserId: userId, telegramUsername: null });
      inserted();
      await held;
    });
    await insertedSignal;
    const linking = consumeWalletProof(
      store,
      identity,
      { ...req, signature: await w.sign(req.message) },
      tenant,
    );
    await new Promise((r) => setTimeout(r, 300));
    release();
    await submission;
    await linking;

    expect(refusal()).toBeUndefined();
    const rows = await a
      .select()
      .from(members)
      .where(and(eq(members.communityId, c.id), eq(members.telegramUserId, userId)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ wallet: w.address, linkMethod: "signature" });
    const links = await a
      .select()
      .from(memberWalletLinks)
      .where(eq(memberWalletLinks.memberId, rows[0]?.id ?? ""));
    expect(links.map((l) => [l.wallet, l.method, l.validTo])).toEqual([
      [w.address, "signature", null],
    ]);
  });
});
