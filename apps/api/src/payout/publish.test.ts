import { communities, epochs, leaves } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../rewards/test-db.js";
import { HYPHAE_PROGRAM_ID } from "./program.js";
import { buildPublication } from "./publication.js";
import { type OnChainEpoch, type PublishChain, publishEpoch } from "./publish.js";
import { randomAddress, seedReadyEpoch } from "./ready-seed.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const GROSS = 500_000_000n;
const FEE_RECIPIENT = "AZo8KrxCovSGasUBcTbsjugkp7pJ5uqRVFF3pYTbpUDR";

// A chain that records what the job asks of it: the community account at `community`, with the
// fee recipient fixed at its initialization, and `onChain`, the epoch account once one exists.
function fakeChain(community: string, onChain: OnChainEpoch | null = null) {
  const calls = { read: 0, publish: [] as Parameters<PublishChain["publishEpoch"]>[0][] };
  let epoch = onChain;
  const chain: PublishChain = {
    network: "solana:devnet",
    programId: HYPHAE_PROGRAM_ID,
    readCommunity: async () => ({ address: community, feeRecipient: FEE_RECIPIENT }),
    readEpoch: async () => {
      calls.read += 1;
      return epoch;
    },
    publishEpoch: async (input) => {
      calls.publish.push(input);
      epoch = {
        root: input.root,
        auditHash: input.auditHash,
        grossLamports: input.grossLamports,
        allocatedLamports: input.allocatedLamports,
      };
      return "sig-publish";
    },
    publishSignature: async () => "sig-found-on-chain",
  };
  return { chain, calls };
}

async function seeded(chainAddress: string | null = randomAddress()) {
  const seed = await seedReadyEpoch(t.db, { now: NOW, chainAddress });
  return { seed, ref: { communityId: seed.communityId, epochId: seed.epochId } };
}
const input = (ref: { communityId: string; epochId: string }) => ({
  ...ref,
  grossLamports: GROSS,
});
const epochRow = async (id: string) =>
  (await t.db.select().from(epochs).where(eq(epochs.id, id)))[0];
async function communityOf(id: string) {
  const [row] = await t.db.select().from(communities).where(eq(communities.id, id));
  if (!row) throw new Error("community");
  return row;
}
const leafRows = (id: string) => t.db.select().from(leaves).where(eq(leaves.epochId, id));

describe("publishEpoch", () => {
  it("publishes a ready epoch once on-chain, then records its leaves and root", async () => {
    const { seed, ref } = await seeded();
    const community = await communityOf(seed.communityId);
    const fake = fakeChain(community.chainAddress as string);

    const out = await publishEpoch(t.db, fake.chain, input(ref));

    const expected = await buildPublication(t.db, ref, {
      grossLamports: GROSS,
      network: "solana:devnet",
      programId: HYPHAE_PROGRAM_ID,
      feeRecipient: FEE_RECIPIENT,
    });
    // The epoch is recorded as published now, so the gate refuses to build it again.
    expect(expected).toEqual({ status: "blocked", blockers: ["already_published"] });
    expect(out).toMatchObject({ status: "published", signature: "sig-publish", recovered: false });
    expect(fake.calls.publish).toHaveLength(1);
    const sent = fake.calls.publish[0];
    expect(sent).toMatchObject({
      community: community.chainAddress,
      index: 1n,
      grossLamports: GROSS,
      allocatedLamports: 304_603_658n,
      feeRecipient: FEE_RECIPIENT,
    });
    if (out.status !== "published") throw new Error("not published");
    expect(sent?.root).toBe(out.root);
    expect(sent?.auditHash).toBe(out.auditHash);

    const row = await epochRow(seed.epochId);
    expect(row).toMatchObject({
      status: "published",
      root: out.root,
      potLamports: GROSS,
      publishTx: "sig-publish",
    });
    expect(row?.publishedAt).toBeInstanceOf(Date);
    const recorded = await leafRows(seed.epochId);
    expect(recorded.map((l) => l.amountLamports).sort()).toEqual(
      [121_250_000n, 100_548_780n, 82_804_878n].sort(),
    );
    expect(recorded.map((l) => l.memberId).sort()).toEqual(
      [seed.members.effort, seed.members.ordinary, seed.members.floor].sort(),
    );
    for (const l of recorded) expect(l.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does nothing the second time: the gate reads the epoch as published", async () => {
    const { seed, ref } = await seeded();
    const community = await communityOf(seed.communityId);
    const fake = fakeChain(community.chainAddress as string);
    await publishEpoch(t.db, fake.chain, input(ref));
    const again = await publishEpoch(t.db, fake.chain, input(ref));
    expect(again).toEqual({ status: "blocked", blockers: ["already_published"] });
    expect(fake.calls.publish).toHaveLength(1);
    expect(await leafRows(seed.epochId)).toHaveLength(3);
  });

  it("sends and records nothing for a blocked or held epoch", async () => {
    const { seed, ref } = await seeded();
    await t.db
      .update(communities)
      .set({ firstPaidEpoch: null })
      .where(eq(communities.id, seed.communityId));
    const community = await communityOf(seed.communityId);
    const fake = fakeChain(community.chainAddress as string);
    const out = await publishEpoch(t.db, fake.chain, input(ref));
    expect(out).toEqual({ status: "blocked", blockers: ["before_first_paid_epoch"] });
    expect(fake.calls).toEqual({ read: 0, publish: [] });
    expect(await leafRows(seed.epochId)).toHaveLength(0);
    expect((await epochRow(seed.epochId))?.root).toBeNull();
  });

  it("refuses a community that is not bound to its on-chain address", async () => {
    const unbound = await seeded(null);
    const fake = fakeChain(randomAddress());
    expect(await publishEpoch(t.db, fake.chain, input(unbound.ref))).toEqual({
      status: "refused",
      reason: "community_not_on_chain",
    });
    const other = await seeded();
    expect(await publishEpoch(t.db, fake.chain, input(other.ref))).toEqual({
      status: "refused",
      reason: "community_not_on_chain",
    });
    expect(fake.calls).toEqual({ read: 0, publish: [] });
  });

  it("refuses a community whose on-chain account is not initialized", async () => {
    const { ref } = await seeded();
    const fake = fakeChain(randomAddress());
    const uninitialized: PublishChain = { ...fake.chain, readCommunity: async () => null };
    expect(await publishEpoch(t.db, uninitialized, input(ref))).toEqual({
      status: "refused",
      reason: "community_not_on_chain",
    });
    expect(fake.calls).toEqual({ read: 0, publish: [] });
  });

  it("records an epoch that is already on-chain with the same commitments, without sending", async () => {
    const { seed, ref } = await seeded();
    const community = await communityOf(seed.communityId);
    const built = await buildPublication(t.db, ref, {
      grossLamports: GROSS,
      network: "solana:devnet",
      programId: HYPHAE_PROGRAM_ID,
      feeRecipient: FEE_RECIPIENT,
    });
    if (built.status !== "ready") throw new Error("not ready");
    const fake = fakeChain(community.chainAddress as string, {
      root: built.root,
      auditHash: built.auditHash,
      grossLamports: GROSS,
      allocatedLamports: built.allocation.allocatedLamports,
    });
    const out = await publishEpoch(t.db, fake.chain, input(ref));
    expect(out).toMatchObject({
      status: "published",
      signature: "sig-found-on-chain",
      recovered: true,
    });
    expect(fake.calls.publish).toHaveLength(0);
    expect((await epochRow(seed.epochId))?.publishTx).toBe("sig-found-on-chain");
  });

  it("stops, and records nothing, when the on-chain epoch commits to something else", async () => {
    const { seed, ref } = await seeded();
    const community = await communityOf(seed.communityId);
    const fake = fakeChain(community.chainAddress as string, {
      root: "ab".repeat(32),
      auditHash: "cd".repeat(32),
      grossLamports: GROSS,
      allocatedLamports: 1n,
    });
    await expect(publishEpoch(t.db, fake.chain, input(ref))).rejects.toThrow(/differs/);
    expect(fake.calls.publish).toHaveLength(0);
    expect(await leafRows(seed.epochId)).toHaveLength(0);
    expect((await epochRow(seed.epochId))?.status).toBe("closed");
  });

  it("records nothing when sending fails, and a later run publishes", async () => {
    const { seed, ref } = await seeded();
    const community = await communityOf(seed.communityId);
    const fake = fakeChain(community.chainAddress as string);
    const failing: PublishChain = {
      ...fake.chain,
      publishEpoch: async () => {
        throw new Error("blockhash expired");
      },
    };
    await expect(publishEpoch(t.db, failing, input(ref))).rejects.toThrow(/blockhash/);
    expect(await leafRows(seed.epochId)).toHaveLength(0);
    const out = await publishEpoch(t.db, fake.chain, input(ref));
    expect(out).toMatchObject({ status: "published", signature: "sig-publish" });
  });
});
