import { fileURLToPath } from "node:url";
import { communities, createDb, members, memberWalletLinks, rulesTestPasses } from "@hyphae/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeModel, seedSignedLink } from "../../http/demo-seed.js";
import { dbClock } from "../../rewards/config.js";
import { runEvaluation } from "../../rewards/evaluation.js";
import { later, seedRewardLane, T0 } from "../../rewards/test-db.js";
import { mePayout } from "./me-summary.js";

// /me's payout read against a relink committed on another connection (scripts/test-pg.sh).
const server = process.env.HYPHAE_TEST_PG_URL;
if (!server) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
// A database of its own: seedRewardLane's community mints repeat in every file.
const NAME = "hyphae_me_relink";
const db = createDb(server.replace(/\/[^/]*$/, `/${NAME}`));

beforeAll(async () => {
  const admin = createDb(server);
  await admin.execute(sql.raw(`drop database if exists ${NAME}`));
  await admin.execute(sql.raw(`create database ${NAME}`));
  await admin.$client.end();
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await db.$client.end();
});

const MIN = 60_000;

describe("mePayout under a concurrent relink", () => {
  it("reads the verdict and the current link as of its clock, never one of each", async () => {
    const l = await seedRewardLane(db);
    const communityId = l.community.id;
    await db.update(communities).set({ firstPaidEpoch: 1 }).where(eq(communities.id, communityId));
    const A = `AAAA${communityId.slice(0, 8)}AAAA`;
    const B = `BBBB${communityId.slice(0, 8)}BBBB`;
    await seedSignedLink(db, {
      communityId,
      memberId: l.member.id,
      telegramUserId: 42n,
      wallet: A,
      tokenDigest: `me-pg-a-${communityId}`,
      linkedAt: T0,
    });
    await db
      .update(members)
      .set({ wallet: A, linkMethod: "signature" })
      .where(eq(members.id, l.member.id));
    await db.insert(rulesTestPasses).values({
      communityId,
      memberId: l.member.id,
      testId: "mycel-rules-1",
      passedAt: new Date(T0.getTime() + MIN),
    });
    const scored = await l.admitOne();
    await runEvaluation(
      db,
      { communityId, target: { contributionId: scored.contributionId } },
      { model: "test:fake", call: fakeModel(85), horizonMs: 5 * MIN, clock: later(2 * MIN) },
    );

    // The relink to B commits on another connection right after the read has taken its clock.
    const relinkAt = new Date(T0.getTime() + 10 * MIN);
    const relink = () =>
      db.transaction(async (tx) => {
        await tx
          .update(memberWalletLinks)
          .set({ validTo: relinkAt })
          .where(
            and(eq(memberWalletLinks.memberId, l.member.id), isNull(memberWalletLinks.validTo)),
          );
        await seedSignedLink(tx, {
          communityId,
          memberId: l.member.id,
          telegramUserId: 42n,
          wallet: B,
          tokenDigest: `me-pg-b-${communityId}`,
          linkedAt: relinkAt,
        });
        await tx
          .update(members)
          .set({ wallet: B, linkMethod: "signature" })
          .where(eq(members.id, l.member.id));
      });
    const status = await mePayout(
      db,
      { communityId, memberId: l.member.id },
      {
        clock: async (tx, id) => {
          await dbClock(tx, id);
          await relink();
          return new Date(T0.getTime() + 20 * MIN);
        },
        decimals: async () => 6,
      },
    );
    expect(status).toMatchObject({
      closed: false,
      payout: { status: "held", reasons: ["hold_pending"], hold: "at_close" },
      wallet: A,
      member: { wallet: A, linkMethod: "signature" },
    });
    // The relink did commit; the next read sees B on both sides.
    expect(
      await mePayout(
        db,
        { communityId, memberId: l.member.id },
        { clock: later(20 * MIN), decimals: async () => 6 },
      ),
    ).toMatchObject({ wallet: B, member: { wallet: B, linkMethod: "signature" } });
  });
});
