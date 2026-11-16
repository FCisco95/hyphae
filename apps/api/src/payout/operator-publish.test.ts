import { distributionPublications, epochPayoutDecisions, epochs, payoutPolicies } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import { MYCEL_MINT } from "./holds.js";
import { operatorPublish } from "./operator-publish.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";
import { fakeSettleChain } from "./settle-fake.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SOL = 1_000_000_000n;

async function setup(
  o: { mint?: string; policy?: boolean; autoPublish?: boolean; bound?: boolean } = {},
) {
  const chainAddress = randomAddress();
  const seed = await seedReadyEpoch(t.db, {
    now: NOW,
    chainAddress: o.bound === false ? null : chainAddress,
    ...(o.mint ? { mint: o.mint } : {}),
  });
  if (o.policy !== false) {
    await t.db.insert(payoutPolicies).values({
      communityId: seed.communityId,
      effectiveFromIndex: 1,
      thresholdVolumeLamports: 100n * SOL,
      basis: "cumulative",
      rewardBpsOfVolume: 100,
      autoPublish: o.autoPublish ?? false,
    });
  }
  return { seed, chainAddress };
}
const run = (
  mint: string,
  chain: ReturnType<typeof fakeSettleChain>["chain"],
  deps: Parameters<typeof operatorPublish>[3] = {},
) => operatorPublish(t.db, chain, { mint }, { clock: () => NOW, ...deps });
const writes = async (communityId: string) => ({
  decisions: (
    await t.db
      .select()
      .from(epochPayoutDecisions)
      .where(eq(epochPayoutDecisions.communityId, communityId))
  ).length,
  intents: (await t.db.select().from(distributionPublications)).filter(
    (p) => p.communityId === communityId,
  ).length,
});

describe("operatorPublish refusals", () => {
  it("refuses a mint with no community", async () => {
    const fake = fakeSettleChain({ community: randomAddress(), free: 2n * SOL });
    expect(await run(randomAddress(), fake.chain)).toEqual({
      status: "refused",
      reason: "community_unknown",
    });
    expect(fake.calls.publish).toEqual([]);
  });

  it("refuses the MYCEL hold, with a policy, a ready epoch and the admin key", async () => {
    const { seed, chainAddress } = await setup({ mint: MYCEL_MINT, autoPublish: true });
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    const out = await run(MYCEL_MINT, fake.chain);
    expect(out).toMatchObject({ status: "refused", reason: "community_held" });
    expect(fake.calls.publish).toEqual([]);
    expect(fake.calls.read).toBe(0);
    expect(await writes(seed.communityId)).toEqual({ decisions: 0, intents: 0 });
  });

  it("refuses a community without a payout policy row, and writes nothing", async () => {
    const { seed, chainAddress } = await setup({ policy: false });
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    expect(await run(seed.mint, fake.chain)).toEqual({
      status: "refused",
      reason: "no_payout_policy",
    });
    expect(fake.calls.publish).toEqual([]);
    expect(await writes(seed.communityId)).toEqual({ decisions: 0, intents: 0 });
  });

  it("refuses a community not bound to an on-chain address", async () => {
    const { seed } = await setup({ bound: false });
    const fake = fakeSettleChain({ community: randomAddress(), free: 2n * SOL });
    expect(await run(seed.mint, fake.chain)).toEqual({
      status: "refused",
      reason: "community_not_on_chain",
    });
    expect(await writes(seed.communityId)).toEqual({ decisions: 0, intents: 0 });
  });

  it("refuses a bound address the chain does not know, before anything is planned", async () => {
    const { seed } = await setup();
    const fake = fakeSettleChain({ community: randomAddress(), free: 2n * SOL });
    expect(await run(seed.mint, fake.chain)).toEqual({
      status: "refused",
      reason: "community_not_on_chain",
    });
    expect(fake.calls.publish).toEqual([]);
    expect(await writes(seed.communityId)).toEqual({ decisions: 0, intents: 0 });
  });

  it("refuses a signer that is not the community admin, before anything is planned", async () => {
    const { seed, chainAddress } = await setup();
    const fake = fakeSettleChain({
      community: chainAddress,
      free: 2n * SOL,
      publisher: randomAddress(),
    });
    expect(await run(seed.mint, fake.chain)).toEqual({
      status: "refused",
      reason: "publisher_not_admin",
    });
    expect(fake.calls.publish).toEqual([]);
    expect(await writes(seed.communityId)).toEqual({ decisions: 0, intents: 0 });
  });

  it("refuses when no signer was given", async () => {
    const { seed, chainAddress } = await setup();
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL, publisher: null });
    expect(await run(seed.mint, fake.chain)).toEqual({ status: "refused", reason: "no_signer" });
    expect(await writes(seed.communityId)).toEqual({ decisions: 0, intents: 0 });
  });
});

describe("operatorPublish", () => {
  it("shows the plan, then publishes once, even when auto_publish is off", async () => {
    const { seed, chainAddress } = await setup({ autoPublish: false });
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    const order: string[] = [];
    const out = await run(seed.mint, fake.chain, {
      beforeSend: async (summary) => {
        order.push(`confirm:${summary.grossLamports}:${fake.calls.publish.length}`);
      },
    });
    expect(out).toMatchObject({ status: "published", epochIndex: 1, grossLamports: 2n * SOL });
    // The plan was shown while nothing had been sent, and the chain saw exactly one publish.
    expect(order).toEqual([`confirm:${2n * SOL}:0`]);
    expect(fake.calls.publish).toHaveLength(1);
    const [epoch] = await t.db.select().from(epochs).where(eq(epochs.id, seed.epochId));
    expect(epoch).toMatchObject({ status: "published", publishTx: "sig-publish" });
  });

  it("sends nothing when the operator declines at the plan", async () => {
    const { seed, chainAddress } = await setup({ autoPublish: false });
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    await expect(
      run(seed.mint, fake.chain, {
        beforeSend: async () => {
          throw new Error("declined");
        },
      }),
    ).rejects.toThrow("declined");
    expect(fake.calls.publish).toEqual([]);
    const [epoch] = await t.db.select().from(epochs).where(eq(epochs.id, seed.epochId));
    expect(epoch?.status).toBe("closed");
  });

  it("resumes after a declined run: the stored plan is sent once, with one decision and one intent", async () => {
    const { seed, chainAddress } = await setup({ autoPublish: false });
    const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL });
    await expect(
      run(seed.mint, fake.chain, {
        beforeSend: async () => {
          throw new Error("declined");
        },
      }),
    ).rejects.toThrow("declined");
    expect(await writes(seed.communityId)).toEqual({ decisions: 1, intents: 1 });
    // More lamports arrive meanwhile: the stored distribution, not a new one, is what is sent.
    const again = fakeSettleChain({ community: chainAddress, free: 3n * SOL });
    const out = await run(seed.mint, again.chain);
    expect(out).toMatchObject({ status: "published", grossLamports: 2n * SOL });
    expect(again.calls.publish).toHaveLength(1);
    expect(await writes(seed.communityId)).toEqual({ decisions: 1, intents: 1 });
  });

  it("does not publish below the volume threshold: the epoch rolls over", async () => {
    const { seed, chainAddress } = await setup();
    const fake = fakeSettleChain({ community: chainAddress, free: SOL / 2n });
    const out = await run(seed.mint, fake.chain);
    expect(out).toMatchObject({ status: "rolled_over", reason: "below_threshold" });
    expect(fake.calls.publish).toEqual([]);
  });
});
