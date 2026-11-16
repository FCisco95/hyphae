import { payoutPolicies } from "@hyphae/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import {
  dueGateReady,
  fromGateReadyJob,
  gateReadyJobId,
  gateReadyText,
  toGateReadyJob,
  topUpToThreshold,
} from "./gate-ready.js";
import { MYCEL_MINT } from "./holds.js";
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
const policy = (over: Partial<Parameters<typeof topUpToThreshold>[0]> = {}) => ({
  thresholdVolumeLamports: 100n * SOL,
  basis: "cumulative" as const,
  rewardBpsOfVolume: 100n,
  pendingVolumeLamports: 0n,
  accrualLamports: 0n,
  ...over,
});

describe("topUpToThreshold", () => {
  it("asks for the accrual whose volume reaches the threshold", () => {
    // 1% of volume reaches the vault: 100 SOL of volume is 1 SOL of accrual.
    expect(topUpToThreshold(policy({ accrualLamports: 4n * (SOL / 10n) }))).toBe(6n * (SOL / 10n));
  });

  it("is zero once the threshold is met", () => {
    expect(topUpToThreshold(policy({ accrualLamports: 2n * SOL }))).toBe(0n);
  });

  it("counts the volume of epochs already rolled over, cumulative only", () => {
    const rolled = { pendingVolumeLamports: 60n * SOL };
    expect(topUpToThreshold(policy({ ...rolled }))).toBe(4n * (SOL / 10n));
    expect(topUpToThreshold(policy({ ...rolled, basis: "per_epoch" }))).toBe(SOL);
  });

  it("rounds up so the topped-up volume reaches the threshold", () => {
    const need = topUpToThreshold(
      policy({ rewardBpsOfVolume: 300n, thresholdVolumeLamports: 100n * SOL + 1n }),
    );
    expect((need as bigint) * 10_000n).toBeGreaterThanOrEqual((100n * SOL + 1n) * 300n);
    expect(((need as bigint) - 1n) * 10_000n).toBeLessThan((100n * SOL + 1n) * 300n);
  });

  it("is unknown when the reward share is unset", () => {
    expect(topUpToThreshold(policy({ rewardBpsOfVolume: null }))).toBeNull();
  });
});

describe("gateReadyJobId", () => {
  it("is the same for an epoch and differs between epochs", () => {
    const a = "5f1c1f66-8f7c-4f0e-9a3a-1c2d3e4f5a6b";
    const b = "5f1c1f66-8f7c-4f0e-9a3a-1c2d3e4f5a6c";
    expect(gateReadyJobId(a)).toBe(gateReadyJobId(a));
    expect(gateReadyJobId(a)).not.toBe(gateReadyJobId(b));
    expect(gateReadyJobId(a)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe("gateReadyText", () => {
  const note = {
    communityId: "c",
    epochId: "e",
    communityName: "Hyphae Ready",
    mint: "M",
    epochIndex: 3,
    payable: 3,
    topUpLamports: 600_000_000n,
    adminTelegramUserId: 1n,
  };
  it("names the epoch, the payable count and the top-up", () => {
    const text = gateReadyText(note);
    expect(text).toContain("epoch 3");
    expect(text).toContain("3 payable");
    expect(text).toContain("0.6 SOL");
    expect(text).toContain("600000000 lamports");
  });
  it("says no top-up is needed when the threshold is met", () => {
    expect(gateReadyText({ ...note, topUpLamports: 0n })).toMatch(/no top-up/i);
  });
  it("says the top-up is unknown when the reward share is unset", () => {
    expect(gateReadyText({ ...note, topUpLamports: null })).toMatch(/top-up unknown/i);
  });
});

async function ready(over: { mint?: string } = {}) {
  const chainAddress = randomAddress();
  const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress, ...over });
  return { seed, chainAddress };
}
const addPolicy = async (communityId: string) => {
  await t.db.insert(payoutPolicies).values({
    communityId,
    effectiveFromIndex: 1,
    thresholdVolumeLamports: 100n * SOL,
    basis: "cumulative",
    rewardBpsOfVolume: 100,
    autoPublish: false,
  });
};
const due = (communityId: string, chain: ReturnType<typeof fakeSettleChain>["chain"]) =>
  dueGateReady(t.db, chain, { communityId }, { clock: () => NOW });

describe("dueGateReady", () => {
  it("reports a ready epoch with its payable count and the top-up", async () => {
    const { seed, chainAddress } = await ready();
    await addPolicy(seed.communityId);
    const fake = fakeSettleChain({ community: chainAddress, free: 4n * (SOL / 10n) });
    const notes = await due(seed.communityId, fake.chain);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      communityId: seed.communityId,
      epochId: seed.epochId,
      epochIndex: 1,
      payable: 3,
      topUpLamports: 6n * (SOL / 10n),
      adminTelegramUserId: 1n,
    });
  });

  it("reports nothing for a community without a payout policy", async () => {
    const { seed, chainAddress } = await ready();
    const fake = fakeSettleChain({ community: chainAddress, free: SOL });
    expect(await due(seed.communityId, fake.chain)).toEqual([]);
  });

  it("reports nothing for a community under a recorded hold", async () => {
    const { seed, chainAddress } = await ready({ mint: MYCEL_MINT });
    await addPolicy(seed.communityId);
    const fake = fakeSettleChain({ community: chainAddress, free: SOL });
    expect(await due(seed.communityId, fake.chain)).toEqual([]);
  });

  it("reports nothing for a community not bound on-chain", async () => {
    const { seed } = await ready();
    await addPolicy(seed.communityId);
    const fake = fakeSettleChain({ community: randomAddress(), free: SOL });
    expect(await due(seed.communityId, fake.chain)).toEqual([]);
  });
});

describe("the queued job", () => {
  it("carries a note through JSON, bigints included", () => {
    const note = {
      communityId: "c",
      epochId: "e",
      communityName: "n",
      mint: "M",
      epochIndex: 2,
      payable: 5,
      topUpLamports: 123n,
      adminTelegramUserId: 99n,
    };
    const wire = JSON.parse(JSON.stringify(toGateReadyJob(note)));
    expect(fromGateReadyJob(wire)).toEqual(note);
    const unknown = JSON.parse(JSON.stringify(toGateReadyJob({ ...note, topUpLamports: null })));
    expect(fromGateReadyJob(unknown).topUpLamports).toBeNull();
  });
});
