import { communities, payoutPolicies } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, type TestDb } from "../rewards/test-db.js";
import {
  applyBind,
  type BindRequest,
  describeBind,
  planBind,
  type ReadBoundCommunity,
} from "./bind-community.js";
import { randomAddress } from "./ready-seed.js";

let db: TestDb;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => {
  await close();
});

const ADMIN = randomAddress();
const FEE = randomAddress();

// The chain read the settle loop uses: a community only at the address bound for its mint.
function chainWith(at: { mint: string; address: string; admin: string }): ReadBoundCommunity {
  return async ({ mint, address }) =>
    mint === at.mint && address === at.address
      ? {
          address,
          admin: at.admin,
          feeRecipient: FEE,
          outstandingLamports: 0n,
          vaultLamports: 953_520n,
          rentExemptMinimum: 953_520n,
        }
      : null;
}

async function setup() {
  const { community } = await seedCommunity(db);
  const chainAddress = randomAddress();
  const request: BindRequest = {
    mint: community.mint,
    chainAddress,
    admin: ADMIN,
    firstPaidEpoch: 1,
    policy: {
      effectiveFromIndex: 1,
      thresholdVolumeLamports: 100_000_000_000n,
      basis: "cumulative",
      rewardBpsOfVolume: 100,
      autoPublish: true,
    },
  };
  const read = chainWith({ mint: community.mint, address: chainAddress, admin: ADMIN });
  return { community, chainAddress, request, read };
}

const row = (id: string) =>
  db
    .select({ chainAddress: communities.chainAddress, firstPaidEpoch: communities.firstPaidEpoch })
    .from(communities)
    .where(eq(communities.id, id));
const policiesOf = (id: string) =>
  db.select().from(payoutPolicies).where(eq(payoutPolicies.communityId, id));

describe("planBind", () => {
  it("writes nothing and names every value the apply would write", async () => {
    const t = await setup();
    const plan = await planBind(db, t.read, t.request);
    expect(plan).toMatchObject({ status: "ready", communityId: t.community.id });
    expect(await row(t.community.id)).toEqual([{ chainAddress: null, firstPaidEpoch: null }]);
    expect(await policiesOf(t.community.id)).toEqual([]);
    if (plan.status !== "ready") return;
    const text = describeBind(plan, t.request).join("\n");
    for (const value of [
      t.community.id,
      t.chainAddress,
      "first_paid_epoch = 1",
      "threshold_volume_lamports 100000000000",
      "basis cumulative",
      "reward_bps_of_volume 100",
      "auto_publish true",
      "effective_from_index 1",
      `admin ${ADMIN}`,
      `fee recipient ${FEE}`,
    ]) {
      expect(text).toContain(value);
    }
  });
});

describe("applyBind", () => {
  it("binds the chain address, the first paid epoch and the policy in one transaction", async () => {
    const t = await setup();
    const out = await applyBind(db, t.read, t.request);
    expect(out.status).toBe("bound");
    expect(await row(t.community.id)).toEqual([
      { chainAddress: t.chainAddress, firstPaidEpoch: 1 },
    ]);
    expect(await policiesOf(t.community.id)).toMatchObject([
      {
        effectiveFromIndex: 1,
        thresholdVolumeLamports: 100_000_000_000n,
        basis: "cumulative",
        rewardBpsOfVolume: 100,
        autoPublish: true,
      },
    ]);
  });

  it("refuses a community that already has a policy, even from another index", async () => {
    const t = await setup();
    await applyBind(db, t.read, t.request);
    const again = { ...t.request, policy: { ...t.request.policy, effectiveFromIndex: 5 } };
    expect(await planBind(db, t.read, again)).toEqual({
      status: "refused",
      reason: "policy_exists",
    });
    expect(await applyBind(db, t.read, again)).toEqual({
      status: "refused",
      reason: "policy_exists",
    });
    expect(await policiesOf(t.community.id)).toHaveLength(1);
  });

  it("refuses a chain address that is not this mint's community under this admin", async () => {
    const t = await setup();
    const elsewhere = { ...t.request, chainAddress: randomAddress() };
    expect(await applyBind(db, t.read, elsewhere)).toEqual({
      status: "refused",
      reason: "not_on_chain",
    });
    const otherAdmin = { ...t.request, admin: randomAddress() };
    expect(await applyBind(db, t.read, otherAdmin)).toEqual({
      status: "refused",
      reason: "admin_mismatch",
    });
    expect(await row(t.community.id)).toEqual([{ chainAddress: null, firstPaidEpoch: null }]);
    expect(await policiesOf(t.community.id)).toEqual([]);
  });

  it("refuses a mint with no community row", async () => {
    const t = await setup();
    const other = { ...t.request, mint: randomAddress() };
    expect(await applyBind(db, t.read, other)).toEqual({
      status: "refused",
      reason: "no_community",
    });
  });

  it("refuses to move a community bound to another address or another first paid epoch", async () => {
    const t = await setup();
    await db
      .update(communities)
      .set({ chainAddress: randomAddress() })
      .where(eq(communities.id, t.community.id));
    expect(await applyBind(db, t.read, t.request)).toEqual({
      status: "refused",
      reason: "bound_elsewhere",
    });

    const u = await setup();
    await db
      .update(communities)
      .set({ firstPaidEpoch: 3 })
      .where(eq(communities.id, u.community.id));
    expect(await applyBind(db, u.read, u.request)).toEqual({
      status: "refused",
      reason: "first_paid_epoch_differs",
    });
    expect(await policiesOf(u.community.id)).toEqual([]);
  });

  it("takes a community already bound to the same address and first paid epoch", async () => {
    const t = await setup();
    await db
      .update(communities)
      .set({ chainAddress: t.chainAddress, firstPaidEpoch: 1 })
      .where(eq(communities.id, t.community.id));
    expect((await applyBind(db, t.read, t.request)).status).toBe("bound");
  });

  it("writes nothing when the policy insert fails after the community update", async () => {
    const t = await setup();
    // The threshold CHECK refuses the insert, which runs after the update in the same transaction.
    const broken = { ...t.request, policy: { ...t.request.policy, thresholdVolumeLamports: 0n } };
    await expect(applyBind(db, t.read, broken)).rejects.toThrow();
    expect(await row(t.community.id)).toEqual([{ chainAddress: null, firstPaidEpoch: null }]);
    expect(await policiesOf(t.community.id)).toEqual([]);
  });
});
