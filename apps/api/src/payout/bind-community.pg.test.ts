import { fileURLToPath } from "node:url";
import { createDb, payoutPolicies } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedCommunity } from "../rewards/test-db.js";
import { applyBind, type BindRequest, type ReadBoundCommunity } from "./bind-community.js";
import { randomAddress } from "./ready-seed.js";

// The bind on Postgres 17 through postgres-js, the production driver (scripts/test-pg.sh): two
// operators binding one community at once, each with a policy from a different index, so the
// unique (community, effective_from_index) index alone would let both land.
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

describe("applyBind on Postgres", () => {
  it("lets exactly one of two concurrent binds write a policy", async () => {
    const { community } = await seedCommunity(a);
    const chainAddress = randomAddress();
    const admin = randomAddress();
    // A slow chain read, so both binds have passed their checks before either one stores.
    const read: ReadBoundCommunity = async ({ mint, address }) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return mint === community.mint && address === chainAddress
        ? {
            address,
            admin,
            feeRecipient: randomAddress(),
            outstandingLamports: 0n,
            vaultLamports: 953_520n,
            rentExemptMinimum: 953_520n,
          }
        : null;
    };
    const request = (from: number): BindRequest => ({
      mint: community.mint,
      chainAddress,
      admin,
      firstPaidEpoch: 1,
      policy: {
        effectiveFromIndex: from,
        thresholdVolumeLamports: 100_000_000_000n,
        basis: "cumulative",
        rewardBpsOfVolume: 100,
        autoPublish: true,
      },
    });
    const outcomes = await Promise.all([
      applyBind(a, read, request(1)),
      applyBind(b, read, request(2)),
    ]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(["bound", "refused"]);
    expect(outcomes.find((o) => o.status === "refused")).toEqual({
      status: "refused",
      reason: "policy_exists",
    });
    const rows = await a
      .select()
      .from(payoutPolicies)
      .where(eq(payoutPolicies.communityId, community.id));
    expect(rows).toHaveLength(1);
  });
});
