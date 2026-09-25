import { fileURLToPath } from "node:url";
import { createDb, epochs, leaves } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HYPHAE_PROGRAM_ID } from "./program.js";
import { buildPublication } from "./publication.js";
import { type OnChainEpoch, type PublishChain, publishEpoch } from "./publish.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";

// R6 publication and the publish job on Postgres 17 through postgres-js, the production driver
// (scripts/test-pg.sh): microsecond timestamps, numeric and bigint columns, jsonb proofs.
const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const pools = Array.from({ length: 2 }, () => createDb(url));
const [a, b] = pools as [ReturnType<typeof createDb>, ReturnType<typeof createDb>];

beforeAll(async () => {
  await migrate(a, {
    migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
  });
});
afterAll(async () => {
  await Promise.all(pools.map((p) => p.$client.end()));
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const GROSS = 500_000_000n;
const SETTINGS = {
  network: "solana:devnet" as const,
  programId: HYPHAE_PROGRAM_ID,
  feeRecipient: "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR",
};

// One on-chain epoch per index, as the program's init constraint enforces.
function sharedChain(community: string) {
  let onChain: OnChainEpoch | null = null;
  let sent = 0;
  const chain: PublishChain = {
    network: SETTINGS.network,
    programId: SETTINGS.programId,
    readCommunity: async () => ({ address: community, feeRecipient: SETTINGS.feeRecipient }),
    readEpoch: async () => onChain,
    publishEpoch: async (input) => {
      if (onChain) throw new Error("account already in use");
      sent += 1;
      onChain = {
        root: input.root,
        auditHash: input.auditHash,
        grossLamports: input.grossLamports,
        allocatedLamports: input.allocatedLamports,
      };
      return "sig-publish";
    },
    publishSignature: async () => "sig-publish",
  };
  return { chain, sent: () => sent };
}

describe("publication and publish on Postgres", () => {
  it("builds the same publication through postgres-js as through PGlite's shape", async () => {
    const seed = await seedReadyEpoch(a, { now: NOW });
    const p = await buildPublication(
      a,
      { communityId: seed.communityId, epochId: seed.epochId },
      { grossLamports: GROSS, ...SETTINGS },
    );
    if (p.status !== "ready") throw new Error(`not ready: ${p.blockers}`);
    expect(p.allocation.allocatedLamports).toBe(304_603_658n);
    expect(p.audit.epoch.closes_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    expect(p.leaves).toHaveLength(3);
  });

  it("records one publication when two runs race", async () => {
    const community = randomAddress();
    const seed = await seedReadyEpoch(a, { now: NOW, chainAddress: community });
    const shared = sharedChain(community);
    const input = {
      communityId: seed.communityId,
      epochId: seed.epochId,
      grossLamports: GROSS,
    };

    const outcomes = await Promise.allSettled([
      publishEpoch(a, shared.chain, input),
      publishEpoch(b, shared.chain, input),
    ]);

    expect(shared.sent()).toBe(1);
    expect(outcomes.some((o) => o.status === "fulfilled" && o.value.status === "published")).toBe(
      true,
    );
    const [row] = await a.select().from(epochs).where(eq(epochs.id, seed.epochId));
    expect(row).toMatchObject({
      status: "published",
      potLamports: GROSS,
      publishTx: "sig-publish",
    });
    expect(row?.publishedAt).toBeInstanceOf(Date);
    const recorded = await a.select().from(leaves).where(eq(leaves.epochId, seed.epochId));
    expect(recorded).toHaveLength(3);
    for (const l of recorded) {
      expect(typeof l.amountLamports).toBe("bigint");
      expect(Array.isArray(l.proof)).toBe(true);
    }
    // A later run only sees an epoch that is already published.
    expect(await publishEpoch(b, shared.chain, input)).toEqual({
      status: "blocked",
      blockers: ["already_published"],
    });
  });
});
