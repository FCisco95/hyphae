import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { communities, createDb, type Db, integrationRaidRequests, tasks } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rubric } from "../rewards/test-db.js";
import type { XPost } from "../x/oembed.js";
import { type PostRaidDeps, postRaid, type RaidRequest } from "./raids.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("Use the disposable test:pg runner");
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

const POST: XPost = {
  id: "1850000000000000001",
  handle: "owner",
  text: "target",
  url: "https://x.com/owner/status/1850000000000000001",
};
let message = 1_000;
function deps(db: Db, announced: string[]): PostRaidDeps {
  return {
    db,
    fetchPost: async () => POST,
    botId: async () => 9n,
    announce: async (_community, _post, task) => {
      announced.push(task.id);
      message += 1;
      return message;
    },
  };
}
async function community() {
  const [row] = await a
    .insert(communities)
    .values({
      mint: `Integration${randomUUID().replaceAll("-", "")}`,
      name: "Integration test",
      telegramChatId: -BigInt(Date.now()) - BigInt(Math.floor(Math.random() * 1e6)),
      adminTelegramUserId: 7n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!row) throw new Error("community");
  return row;
}
const request = (): RaidRequest => ({
  idempotency_key: randomUUID(),
  post_url: POST.url,
  brief: "Explain",
  closes_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
  actor: { organic_user_id: randomUUID(), role: "admin" },
});

describe("Organic raids on two real Postgres pools", () => {
  it("racing copies of one request open one raid and announce it once", async () => {
    const c = await community();
    const announced: string[] = [];
    const same = request();
    const results = await Promise.all([
      postRaid(deps(a, announced), c.mint, "k", same),
      postRaid(deps(b, announced), c.mint, "k", same),
    ]);
    expect(results.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
    for (const r of results)
      if (r.status !== 201) expect(r).toEqual({ status: 409, error: "request_in_progress" });
    expect(announced).toHaveLength(1);
    expect(await a.select().from(tasks).where(eq(tasks.communityId, c.id))).toHaveLength(1);
    const [row] = await a
      .select()
      .from(integrationRaidRequests)
      .where(eq(integrationRaidRequests.communityId, c.id));
    expect(row?.state).toBe("created");
  });

  it("racing distinct requests never open more than three raids", async () => {
    const c = await community();
    const announced: string[] = [];
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        postRaid(deps(i % 2 ? b : a, announced), c.mint, "k", request()),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409 && r.error === "open_raid_limit")).toHaveLength(
      2,
    );
    expect(announced).toHaveLength(3);
  });
});
