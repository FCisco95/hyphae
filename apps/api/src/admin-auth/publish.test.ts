import { communityAddress, HYPHAE_PROGRAM_ID } from "@hyphae/core";
import {
  distributionPublicationEpochMembers,
  distributionPublicationMembers,
  distributionPublications,
  epochPayoutDecisions,
  epochs,
  leaves,
  payoutPolicies,
} from "@hyphae/db";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  type Address,
  address,
  generateKeyPairSigner,
  getAddressEncoder,
  getBase58Decoder,
  getBase64Encoder,
  getTransactionDecoder,
  type KeyPairSigner,
  signBytes,
  type TransactionPartialSigner,
  type TransactionSigner,
} from "@solana/kit";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { solanaChain } from "../payout/chain.js";
import type { SettleChain } from "../payout/distribution-settle.js";
import { sameBytes } from "../payout/handoff.js";
import { operatorPublish } from "../payout/operator-publish.js";
import type { PublishArgs } from "../payout/publish.js";
import { randomAddress, seedReadyEpoch } from "../payout/ready-seed.js";
import { type FakeAccount, fakeRpc } from "../payout/rpc-fake.js";
import { fakeSettleChain } from "../payout/settle-fake.js";
import { createTestDb } from "../rewards/test-db.js";
import { buildStore } from "./builds.js";
import {
  buildInit,
  buildPublish,
  type Operator,
  type PublishDeps,
  submitInit,
  submitPublish,
} from "./publish.js";

// A recorded hold the test can add while a build waits: the hold is checked at both steps.
const held = vi.hoisted(() => new Set<string>());
vi.mock("../payout/holds.js", async (original) => {
  const real = await original<typeof import("../payout/holds.js")>();
  return {
    ...real,
    communityHold: (mint: string) =>
      real.communityHold(mint) ?? (held.has(mint) ? { mint, reason: "test hold" } : null),
  };
});
const { MYCEL_MINT } = await import("../payout/holds.js");

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T12:00:00.000Z");
const SOL = 1_000_000_000n;
const b58 = getBase58Decoder();
class Stop extends Error {}

async function world(
  o: { mint?: string; policy?: boolean; bound?: boolean; admin?: KeyPairSigner } = {},
) {
  const kp = o.admin ?? (await generateKeyPairSigner());
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
      autoPublish: false,
    });
  }
  const fake = fakeSettleChain({ community: chainAddress, free: 2n * SOL, admin: kp.address });
  const rpc = fakeRpc();
  const sending = (signer: TransactionSigner) =>
    solanaChain({
      rpcUrl: "https://rpc.test",
      wsUrl: "wss://rpc.test",
      network: "solana:devnet",
      admin: signer,
      rpc: rpc.rpc,
      rpcSubscriptions: rpc.rpcSubscriptions,
    });
  // The CLI run's settle chain: the fake's reads, and solanaChain's send for the publisher, as
  // settleChain builds it. Without a publisher it is read-only.
  const chain = async (publisher?: TransactionSigner): Promise<SettleChain> => ({
    ...fake.chain,
    publisher: publisher
      ? {
          address: publisher.address,
          publishEpoch: async (input) => (await sending(publisher)).chain.publishEpoch(input),
        }
      : null,
  });
  const sent: string[] = [];
  let height = 10n;
  const deps: PublishDeps = {
    network: "solana:devnet",
    chain,
    sending,
    send: async (transaction) => {
      const [signature] = Object.values(transaction.signatures);
      const text = b58.decode(signature as Uint8Array);
      sent.push(text);
      return text;
    },
    blockHeight: async () => height,
    startHeight: async () => 0n,
    builds: buildStore(),
    setupRecords: [],
    gate: { clock: () => NOW },
  };
  const operator: Operator = {
    id: crypto.randomUUID(),
    role: "admin",
    mint: seed.mint,
    wallet: kp.address,
  };
  return {
    kp,
    seed,
    fake,
    rpc,
    deps,
    operator,
    sent,
    chain,
    setHeight: (h: bigint) => {
      height = h;
    },
  };
}

// The CLI's `publish-epoch run`, stopped where its Ledger would be asked: the PublishArgs the
// planner sent and the message bytes the chain code compiled.
async function cliRun(w: Awaited<ReturnType<typeof world>>) {
  const seen: { args: PublishArgs | null; bytes: Uint8Array | null } = { args: null, bytes: null };
  const ledger: TransactionPartialSigner = {
    address: w.kp.address,
    async signTransactions(txs) {
      seen.bytes = new Uint8Array(txs[0]?.messageBytes ?? []);
      throw new Stop();
    },
  };
  const chain = await w.chain(ledger);
  const publisher = chain.publisher;
  const watched: SettleChain = {
    ...chain,
    publisher: publisher && {
      address: publisher.address,
      publishEpoch: (input) => {
        seen.args = input;
        return publisher.publishEpoch(input);
      },
    },
  };
  await expect(
    operatorPublish(t.db, watched, { mint: w.seed.mint }, { clock: () => NOW }),
  ).rejects.toThrow(Stop);
  return seen;
}

const awaiting = <T extends { status: string }>(out: T) => {
  if (out.status !== "awaiting_signature") throw new Error(`not awaiting: ${JSON.stringify(out)}`);
  return out as Extract<T, { status: "awaiting_signature" }>;
};
const messageOf = (out: { message: string }) =>
  new Uint8Array(getBase64Encoder().encode(out.message));
const signedBy = async (kp: KeyPairSigner, bytes: Uint8Array) =>
  b58.decode(await signBytes(kp.keyPair.privateKey, bytes));
const intents = async (communityId: string) =>
  (await t.db.select().from(distributionPublications)).filter((p) => p.communityId === communityId)
    .length;

describe("browser publish equals publish-epoch run", () => {
  it("hands the wallet the CLI run's message for the plan the browser stored", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const cli = await cliRun(w);
    expect(cli.bytes && sameBytes(cli.bytes, messageOf(built))).toBe(true);
    const plan = w.deps.builds.latest(w.operator.id, w.seed.mint)?.plan;
    expect(plan?.kind === "publish" && plan.args).toEqual(cli.args);
    expect(await intents(w.seed.communityId)).toBe(1);
  });

  it("hands the wallet the CLI run's message for the plan the CLI stored", async () => {
    const w = await world();
    const cli = await cliRun(w);
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    expect(cli.bytes && sameBytes(cli.bytes, messageOf(built))).toBe(true);
    // The unsigned wire transaction carries the same message and one empty signature slot.
    const tx = getTransactionDecoder().decode(getBase64Encoder().encode(built.transaction));
    expect(sameBytes(new Uint8Array(tx.messageBytes), messageOf(built))).toBe(true);
    expect(tx.signatures).toEqual({ [w.kp.address]: null });
  });

  it("shows every number the transaction commits to before the wallet opens", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const s = built.summary;
    expect(s).toMatchObject({
      network: "solana:devnet",
      program_id: HYPHAE_PROGRAM_ID,
      epoch_index: 1,
      epochs_paid: 1,
      gross_lamports: (2n * SOL).toString(),
      fee_bps: 300,
      accounts: {
        fee_payer: w.kp.address,
        community: w.fake.chain.programId && expect.any(String),
      },
    });
    expect(BigInt(s.fee_lamports) + BigInt(s.net_lamports)).toBe(2n * SOL);
    expect(s.payable_wallets).toBeGreaterThan(0);
    expect(s.message_hash).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
    expect(w.sent).toEqual([]);
  });
});

describe("browser publish submit", () => {
  it("sends the signed build once and records it as the CLI run does", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const signature = await signedBy(w.kp, messageOf(built));
    const out = await submitPublish(t.db, w.deps, w.operator, {
      buildId: built.build.id,
      signature,
    });
    expect(out).toEqual({ status: "published", signature, epoch_index: 1, recovered: false });
    expect(w.sent).toEqual([signature]);
    const [epoch] = await t.db.select().from(epochs).where(eq(epochs.id, w.seed.epochId));
    expect(epoch).toMatchObject({
      status: "published",
      publishTx: signature,
      root: built.summary.root,
    });
    const paid = await t.db.select().from(leaves).where(eq(leaves.epochId, w.seed.epochId));
    expect(paid).toHaveLength(built.summary.payable_wallets);
    expect(w.deps.builds.latest(w.operator.id, w.seed.mint)).toMatchObject({
      state: "done",
      signature,
    });
  });

  it("refuses a replayed build: one send, ever", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const signature = await signedBy(w.kp, messageOf(built));
    const input = { buildId: built.build.id, signature };
    expect((await submitPublish(t.db, w.deps, w.operator, input)).status).toBe("published");
    expect(await submitPublish(t.db, w.deps, w.operator, input)).toEqual({
      status: "refused",
      reason: "build_unknown",
    });
    expect(w.sent).toHaveLength(1);
  });

  it("refuses a build from another session, and leaves it for its own", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const signature = await signedBy(w.kp, messageOf(built));
    const input = { buildId: built.build.id, signature };
    const other = { ...w.operator, id: crypto.randomUUID() };
    expect(await submitPublish(t.db, w.deps, other, input)).toEqual({
      status: "refused",
      reason: "build_unknown",
    });
    expect((await submitPublish(t.db, w.deps, w.operator, input)).status).toBe("published");
  });

  it("refuses a signature over altered bytes or by another key, and burns the build", async () => {
    const w = await world();
    const other = await generateKeyPairSigner();
    for (const sign of [
      async (bytes: Uint8Array) => {
        // A wallet that changed the transaction (say, added a priority fee) signed other bytes.
        const altered = Uint8Array.from(bytes);
        altered[altered.length - 1] = (altered[altered.length - 1] as number) ^ 1;
        return signedBy(w.kp, altered);
      },
      (bytes: Uint8Array) => signedBy(other, bytes),
    ]) {
      const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
      const bad = await sign(messageOf(built));
      expect(
        await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature: bad }),
      ).toEqual({ status: "refused", reason: "signature_invalid" });
      const good = await signedBy(w.kp, messageOf(built));
      expect(
        await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature: good }),
      ).toEqual({ status: "refused", reason: "build_unknown" });
    }
    expect(w.sent).toEqual([]);
  });

  it("refuses a build whose blockhash expired", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    w.setHeight(BigInt(built.summary.last_valid_block_height) + 1n);
    const signature = await signedBy(w.kp, messageOf(built));
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({ status: "refused", reason: "expired" });
    expect(w.sent).toEqual([]);
  });

  it("refuses a build a newer build replaced", async () => {
    const w = await world();
    const first = awaiting(await buildPublish(t.db, w.deps, w.operator));
    awaiting(await buildPublish(t.db, w.deps, w.operator));
    const signature = await signedBy(w.kp, messageOf(first));
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: first.build.id, signature }),
    ).toEqual({ status: "refused", reason: "build_unknown" });
  });

  it("refuses a changed plan: the epoch was published meanwhile, nothing is sent", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    // The CLI run published the planned distribution in between (its fake publisher).
    expect(
      (await operatorPublish(t.db, w.fake.chain, { mint: w.seed.mint }, { clock: () => NOW }))
        .status,
    ).toBe("published");
    const signature = await signedBy(w.kp, messageOf(built));
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({ status: "refused", reason: "plan_changed" });
    expect(w.sent).toEqual([]);
  });

  it("refuses a changed plan: the planner reaches a send with other numbers", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    // The stored plan is gone and the vault holds more: the planner now plans a larger pot.
    const [intent] = await t.db
      .select({ id: distributionPublications.id })
      .from(distributionPublications)
      .where(eq(distributionPublications.communityId, w.seed.communityId));
    if (!intent) throw new Error("no intent");
    await t.db
      .delete(distributionPublicationEpochMembers)
      .where(eq(distributionPublicationEpochMembers.publicationId, intent.id));
    await t.db
      .delete(distributionPublicationMembers)
      .where(eq(distributionPublicationMembers.publicationId, intent.id));
    await t.db.delete(distributionPublications).where(eq(distributionPublications.id, intent.id));
    await t.db
      .delete(epochPayoutDecisions)
      .where(eq(epochPayoutDecisions.communityId, w.seed.communityId));
    w.fake.state.free = 3n * SOL;
    const signature = await signedBy(w.kp, messageOf(built));
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({ status: "refused", reason: "plan_changed" });
    expect(w.sent).toEqual([]);
  });

  it("refuses at submit an admin rotated after the build", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    w.fake.state.admin = randomAddress();
    const signature = await signedBy(w.kp, messageOf(built));
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({ status: "refused", reason: "publisher_not_admin" });
    expect(w.sent).toEqual([]);
  });

  it("refuses at submit a hold recorded after the build", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    held.add(w.seed.mint);
    try {
      const signature = await signedBy(w.kp, messageOf(built));
      expect(
        await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
      ).toEqual({ status: "refused", reason: "community_held" });
    } finally {
      held.delete(w.seed.mint);
    }
    expect(w.sent).toEqual([]);
  });

  it("says unconfirmed, and records nothing, when the cluster refuses the transaction", async () => {
    const w = await world();
    const { SendError } = await import("../payout/chain.js");
    w.deps.send = async () => {
      throw new SendError("x", new Error("blockhash not found"));
    };
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const signature = await signedBy(w.kp, messageOf(built));
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({ status: "unconfirmed", signature: "x" });
    const [epoch] = await t.db.select().from(epochs).where(eq(epochs.id, w.seed.epochId));
    expect(epoch?.status).toBe("closed");
  });
});

describe("browser publish refusals at build", () => {
  it("refuses the MYCEL hold and writes nothing", async () => {
    const w = await world({ mint: MYCEL_MINT });
    expect(await buildPublish(t.db, w.deps, w.operator)).toEqual({
      status: "refused",
      reason: "community_held",
    });
    expect(await intents(w.seed.communityId)).toBe(0);
    expect(w.rpc.seen.simulated).toEqual([]);
  });

  it("refuses a community without a payout policy row", async () => {
    const w = await world({ policy: false });
    expect(await buildPublish(t.db, w.deps, w.operator)).toEqual({
      status: "refused",
      reason: "no_payout_policy",
    });
  });

  it("refuses a community without a chain binding", async () => {
    const w = await world({ bound: false });
    expect(await buildPublish(t.db, w.deps, w.operator)).toEqual({
      status: "refused",
      reason: "community_not_on_chain",
    });
  });

  it("refuses a wallet that is not the on-chain admin, before anything is planned", async () => {
    const w = await world();
    const operator = { ...w.operator, wallet: randomAddress() };
    expect(await buildPublish(t.db, w.deps, operator)).toEqual({
      status: "refused",
      reason: "publisher_not_admin",
    });
    expect(await intents(w.seed.communityId)).toBe(0);
  });

  it("rolls an epoch below the threshold over, as the CLI run does, and hands off nothing", async () => {
    const w = await world();
    w.fake.state.free = SOL / 2n;
    expect(await buildPublish(t.db, w.deps, w.operator)).toMatchObject({
      status: "rolled_over",
      epoch_index: 1,
      reason: "below_threshold",
    });
    expect(w.deps.builds.latest(w.operator.id, w.seed.mint)).toBeNull();
  });
});

// The Community account's bytes: discriminator, mint, admin, fee recipient, outstanding, bumps.
function communityBytes(mint: string, admin: string, fee: string): Uint8Array {
  const e = getAddressEncoder();
  return Uint8Array.from([
    ...sha256(utf8ToBytes("account:Community")).slice(0, 8),
    ...e.encode(address(mint)),
    ...e.encode(address(admin)),
    ...e.encode(address(fee)),
    ...new Uint8Array(8),
    255,
    254,
  ]);
}

async function setupWorld(o: { bound?: boolean; exists?: boolean } = {}) {
  const kp = await generateKeyPairSigner();
  const seed = await seedReadyEpoch(t.db, {
    now: NOW,
    chainAddress: o.bound ? randomAddress() : null,
  });
  const feeRecipient = randomAddress();
  const programId = HYPHAE_PROGRAM_ID as Address;
  const community = await communityAddress(programId, address(seed.mint), kp.address);
  const accounts = new Map<string, FakeAccount>([
    [programId, { owner: "BPFLoaderUpgradeab1e", executable: true }],
    [feeRecipient, { owner: "11111111111111111111111111111111" }],
  ]);
  const created = { owner: programId, data: communityBytes(seed.mint, kp.address, feeRecipient) };
  if (o.exists) accounts.set(community, created);
  const rpc = fakeRpc({ accounts, balances: new Map([[kp.address, 5n * SOL]]) });
  const sent: string[] = [];
  const deps: PublishDeps = {
    network: "solana:devnet",
    chain: async () => {
      throw new Error("not used by init");
    },
    sending: (signer) =>
      solanaChain({
        rpcUrl: "https://rpc.test",
        wsUrl: "wss://rpc.test",
        network: "solana:devnet",
        admin: signer,
        rpc: rpc.rpc,
        rpcSubscriptions: rpc.rpcSubscriptions,
      }),
    send: async (transaction) => {
      const text = b58.decode(Object.values(transaction.signatures)[0] as Uint8Array);
      sent.push(text);
      accounts.set(community, created);
      return text;
    },
    blockHeight: async () => 10n,
    startHeight: async () => 0n,
    builds: buildStore(),
    setupRecords: [{ mint: seed.mint, network: "solana:devnet", admin: kp.address, feeRecipient }],
  };
  const operator: Operator = {
    id: crypto.randomUUID(),
    role: "setup",
    mint: seed.mint,
    wallet: kp.address,
  };
  return { kp, seed, deps, operator, sent, feeRecipient, community, rpc };
}

describe("browser init-community", () => {
  it("hands off what init-community.ts sends, then sends it once and reads it back", async () => {
    const w = await setupWorld();
    const built = awaiting(
      await buildInit(t.db, w.deps, w.operator, { feeRecipient: w.feeRecipient }),
    );
    // The CLI's send for the same target, stopped where its Ledger would be asked.
    const { initInstructions } = await import("../payout/community-init.js");
    let cli: Uint8Array | null = null;
    const ledger: TransactionPartialSigner = {
      address: w.kp.address,
      async signTransactions(txs) {
        cli = new Uint8Array(txs[0]?.messageBytes ?? []);
        throw new Stop();
      },
    };
    const target = {
      programId: HYPHAE_PROGRAM_ID as Address,
      admin: w.kp.address,
      mint: w.seed.mint,
      feeRecipient: w.feeRecipient,
    };
    await expect(
      (await w.deps.sending(ledger)).send(await initInstructions(target, ledger)),
    ).rejects.toThrow(Stop);
    expect(cli && sameBytes(cli, messageOf(built))).toBe(true);
    expect(built.summary).toMatchObject({
      admin: w.kp.address,
      mint: w.seed.mint,
      community: w.community,
      fee_recipient: w.feeRecipient,
      admin_lamports: (5n * SOL).toString(),
    });
    const signature = await signedBy(w.kp, messageOf(built));
    expect(
      await submitInit(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toMatchObject({ status: "initialized", signature, community: w.community });
    expect(w.sent).toEqual([signature]);
  });

  it("refuses a fee recipient that differs from the recorded one", async () => {
    const w = await setupWorld();
    expect(await buildInit(t.db, w.deps, w.operator, { feeRecipient: randomAddress() })).toEqual({
      status: "refused",
      reason: "fee_recipient_mismatch",
    });
  });

  it("refuses an existing community account", async () => {
    const w = await setupWorld({ exists: true });
    expect(await buildInit(t.db, w.deps, w.operator, { feeRecipient: w.feeRecipient })).toEqual({
      status: "refused",
      reason: "community_exists",
    });
  });

  it("refuses an admin session, a bound community and a wallet the record does not name", async () => {
    const w = await setupWorld();
    for (const operator of [
      { ...w.operator, role: "admin" as const },
      { ...w.operator, wallet: randomAddress() },
      { ...w.operator, mint: randomAddress() },
    ]) {
      expect(await buildInit(t.db, w.deps, operator, { feeRecipient: w.feeRecipient })).toEqual({
        status: "refused",
        reason: "not_setup",
      });
    }
    const bound = await setupWorld({ bound: true });
    expect(
      await buildInit(t.db, bound.deps, bound.operator, { feeRecipient: bound.feeRecipient }),
    ).toEqual({ status: "refused", reason: "not_setup" });
  });

  it("refuses at submit a community initialized meanwhile, and a forged signature", async () => {
    const w = await setupWorld();
    const built = awaiting(
      await buildInit(t.db, w.deps, w.operator, { feeRecipient: w.feeRecipient }),
    );
    const other = await generateKeyPairSigner();
    expect(
      await submitInit(t.db, w.deps, w.operator, {
        buildId: built.build.id,
        signature: await signedBy(other, messageOf(built)),
      }),
    ).toEqual({ status: "refused", reason: "signature_invalid" });
    const again = awaiting(
      await buildInit(t.db, w.deps, w.operator, { feeRecipient: w.feeRecipient }),
    );
    await w.deps.send({ signatures: { x: new Uint8Array(64) } } as never);
    w.sent.length = 0;
    expect(
      await submitInit(t.db, w.deps, w.operator, {
        buildId: again.build.id,
        signature: await signedBy(w.kp, messageOf(again)),
      }),
    ).toEqual({ status: "refused", reason: "community_exists" });
    expect(w.sent).toEqual([]);
  });
});

// Review round 1 (Codex, 2026-11-24): recovery, unconfirmed sends and the session's builds.
async function replacePlan(w: Awaited<ReturnType<typeof world>>, free: bigint) {
  const [intent] = await t.db
    .select({ id: distributionPublications.id })
    .from(distributionPublications)
    .where(eq(distributionPublications.communityId, w.seed.communityId));
  if (!intent) throw new Error("no intent");
  await t.db
    .delete(distributionPublicationEpochMembers)
    .where(eq(distributionPublicationEpochMembers.publicationId, intent.id));
  await t.db
    .delete(distributionPublicationMembers)
    .where(eq(distributionPublicationMembers.publicationId, intent.id));
  await t.db.delete(distributionPublications).where(eq(distributionPublications.id, intent.id));
  await t.db
    .delete(epochPayoutDecisions)
    .where(eq(epochPayoutDecisions.communityId, w.seed.communityId));
  w.fake.state.free = free;
}

describe("browser publish submit, recovery and uncertain sends", () => {
  it("records the build's own plan when it is already on-chain, with its signature", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const plan = w.deps.builds.latest(w.operator.id, w.seed.mint)?.plan;
    if (plan?.kind !== "publish") throw new Error("no plan");
    // This build's transaction landed earlier (a lost response), unrecorded.
    w.fake.state.onChain.set(plan.args.index, {
      root: plan.args.root,
      auditHash: plan.args.auditHash,
      grossLamports: plan.args.grossLamports,
      allocatedLamports: plan.args.allocatedLamports,
    });
    const signature = await signedBy(w.kp, messageOf(built));
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({
      status: "published",
      signature: "sig-found-on-chain",
      epoch_index: 1,
      recovered: true,
    });
    expect(w.sent).toEqual([]);
    expect(w.deps.builds.latest(w.operator.id, w.seed.mint)).toMatchObject({
      state: "done",
      signature: "sig-found-on-chain",
    });
  });

  it("refuses to recover another plan than the one signed, and records nothing", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    // The plan is replaced by a larger one, which another run sent and did not record.
    await replacePlan(w, 3n * SOL);
    const other = await cliRun(w);
    if (!other.args) throw new Error("no plan");
    w.fake.state.onChain.set(other.args.index, {
      root: other.args.root,
      auditHash: other.args.auditHash,
      grossLamports: other.args.grossLamports,
      allocatedLamports: other.args.allocatedLamports,
    });
    const signature = await signedBy(w.kp, messageOf(built));
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({ status: "refused", reason: "plan_changed" });
    const [epoch] = await t.db.select().from(epochs).where(eq(epochs.id, w.seed.epochId));
    expect(epoch?.status).toBe("closed");
    expect(w.sent).toEqual([]);
  });

  it("keeps the signature of a send whose confirmation failed, and says it is unconfirmed", async () => {
    const w = await world();
    const { SendError } = await import("../payout/chain.js");
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const signature = await signedBy(w.kp, messageOf(built));
    w.deps.send = async () => {
      throw new SendError(signature, new Error("block height exceeded"));
    };
    expect(
      await submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({ status: "unconfirmed", signature });
    expect(w.deps.builds.latest(w.operator.id, w.seed.mint)).toMatchObject({
      state: "failed",
      signature,
    });
  });

  it("finds each of the session's builds by id, not only the latest", async () => {
    const w = await world();
    const first = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const second = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const recent = w.deps.builds.recent(w.operator.id, w.seed.mint).map((b) => b.id);
    expect(recent).toEqual([first.build.id, second.build.id]);
    expect(w.deps.builds.recent(crypto.randomUUID(), w.seed.mint)).toEqual([]);
  });
});

describe("browser init submit, uncertain sends", () => {
  it("keeps the signature of an init whose confirmation failed", async () => {
    const w = await setupWorld();
    const { SendError } = await import("../payout/chain.js");
    const built = awaiting(
      await buildInit(t.db, w.deps, w.operator, { feeRecipient: w.feeRecipient }),
    );
    const signature = await signedBy(w.kp, messageOf(built));
    w.deps.send = async () => {
      throw new SendError(signature, new Error("block height exceeded"));
    };
    expect(
      await submitInit(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
    ).toEqual({ status: "unconfirmed", signature });
  });
});

// Review round 2 (Codex, 2026-11-24).
describe("browser publish submit, review round 2", () => {
  it("keeps a recovered signature when the record after it fails", async () => {
    const w = await world();
    const built = awaiting(await buildPublish(t.db, w.deps, w.operator));
    const plan = w.deps.builds.latest(w.operator.id, w.seed.mint)?.plan;
    if (plan?.kind !== "publish") throw new Error("no plan");
    w.fake.state.onChain.set(plan.args.index, {
      root: plan.args.root,
      auditHash: plan.args.auditHash,
      grossLamports: plan.args.grossLamports,
      allocatedLamports: plan.args.allocatedLamports,
    });
    // The database refuses the record once the lookup has found the transaction.
    let found = false;
    const lookup = w.fake.chain.publishSignature;
    w.fake.chain.publishSignature = async (input) => {
      const signature = await lookup(input);
      found = true;
      return signature;
    };
    const transaction = t.db.transaction.bind(t.db);
    const spy = vi.spyOn(t.db, "transaction").mockImplementation(((...a: unknown[]) => {
      if (found) throw new Error("database down");
      return (transaction as (...b: unknown[]) => unknown)(...a);
    }) as never);
    try {
      const signature = await signedBy(w.kp, messageOf(built));
      await expect(
        submitPublish(t.db, w.deps, w.operator, { buildId: built.build.id, signature }),
      ).rejects.toThrow("database down");
    } finally {
      spy.mockRestore();
    }
    expect(w.deps.builds.latest(w.operator.id, w.seed.mint)).toMatchObject({
      state: "failed",
      signature: "sig-found-on-chain",
    });
  });

  it("refuses one session's signature on another session's identical build", async () => {
    const w = await world();
    const a = awaiting(await buildPublish(t.db, w.deps, w.operator));
    // Same wallet, same plan, same blockhash: the same message, built for another session.
    const other = { ...w.operator, id: crypto.randomUUID() };
    const b = awaiting(await buildPublish(t.db, w.deps, other));
    expect(sameBytes(messageOf(a), messageOf(b))).toBe(true);
    const signatureA = await signedBy(w.kp, messageOf(a));
    expect(
      await submitPublish(t.db, w.deps, other, { buildId: b.build.id, signature: signatureA }),
    ).toEqual({ status: "refused", reason: "build_unknown" });
    expect(w.sent).toEqual([]);
    // Once the blockhash moves on, the other session builds and sends its own message.
    w.rpc.setBlockhash("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG");
    const fresh = awaiting(await buildPublish(t.db, w.deps, other));
    const signature = await signedBy(w.kp, messageOf(fresh));
    expect(
      (await submitPublish(t.db, w.deps, other, { buildId: fresh.build.id, signature })).status,
    ).toBe("published");
  });
});

// Review round 5 (Codex, 2026-11-24): a signature made before an API restart.
describe("browser publish after an API restart", () => {
  it("builds only on a blockhash newer than the API's start", async () => {
    const w = await world();
    // The process started at a height whose blockhashes are the ones the RPC still serves.
    const { FAKE_LAST_VALID } = await import("../payout/rpc-fake.js");
    w.deps.startHeight = async () => FAKE_LAST_VALID - 150n;
    await expect(buildPublish(t.db, w.deps, w.operator)).rejects.toThrow(/newer than/);
    expect(w.deps.builds.latest(w.operator.id, w.seed.mint)).toBeNull();
    w.deps.startHeight = async () => FAKE_LAST_VALID - 151n;
    awaiting(await buildPublish(t.db, w.deps, w.operator));
  });
});
