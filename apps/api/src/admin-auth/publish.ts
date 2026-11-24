import type {
  OperatorBuildState,
  OperatorInitBuild,
  OperatorInitSubmit,
  OperatorPublishBuild,
  OperatorPublishSubmit,
} from "@hyphae/core";
import { communities, type Db, epochs } from "@hyphae/db";
import {
  type Address,
  getBase64Decoder,
  getTransactionEncoder,
  type TransactionSigner,
} from "@solana/kit";
import { and, eq } from "drizzle-orm";
import { publishAccounts, SendError, type solanaChain } from "../payout/chain.js";
import { initInstructions, planCommunityInit } from "../payout/community-init.js";
import { loadDistributionIntent } from "../payout/distribution-intent.js";
import type { SettleChain } from "../payout/distribution-settle.js";
import type { GateDeps } from "../payout/gate.js";
import {
  handoffSigner,
  messageBytesFor,
  messageHash,
  publishMessageBytes,
  SignatureRequired,
  type SignedHandoff,
  sameBytes,
  signedTransaction,
  verifiedSignature,
} from "../payout/handoff.js";
import { operatorPublish } from "../payout/operator-publish.js";
import type { PublishArgs } from "../payout/publish.js";
import type { BuildPlan, BuildRecord, BuildStore } from "./builds.js";
import { type SetupRecord, setupRecord } from "./setup-records.js";

// The operator page's publish and init-community (roadmap item 3, part B). A build runs the CLI
// run's own planner (operatorPublish) and chain code with a hand-off signer in the Ledger's place:
// what the wallet is asked to sign is what `publish-epoch run` would send for the same plan. A
// submit takes only a signature, checks it over the stored bytes, and runs the planner again with
// a publisher that sends the signed transaction only if the planner reaches the same send. Every
// refusal of the planner (recorded hold, no policy, no binding, signer not the admin) applies at
// both steps. Nothing here holds or makes a key.

export interface PublishDeps {
  network: SettleChain["network"];
  // The CLI run's settle chain (settleChain) with this publisher; read-only without one.
  chain(publisher?: TransactionSigner): Promise<SettleChain>;
  // init-community's chain (solanaChain) for this signer.
  sending(
    signer: TransactionSigner,
  ): Promise<Pick<Awaited<ReturnType<typeof solanaChain>>, "rpc" | "programId" | "send">>;
  // Sends a signed hand-off and waits for its confirmation; returns its signature.
  send(transaction: SignedHandoff): Promise<string>;
  // The cluster's confirmed block height, to refuse a build whose blockhash has expired.
  blockHeight(): Promise<bigint>;
  builds: BuildStore;
  setupRecords: readonly SetupRecord[];
  gate?: GateDeps;
  log?: (line: Record<string, string | number | boolean | null>) => void;
}

export interface Operator {
  id: string;
  role: "admin" | "setup";
  mint: string;
  wallet: string;
}

class PlanChanged extends Error {}

const sameArgs = (a: PublishArgs, b: PublishArgs) =>
  a.community === b.community &&
  a.index === b.index &&
  a.root === b.root &&
  a.auditHash === b.auditHash &&
  a.grossLamports === b.grossLamports &&
  a.allocatedLamports === b.allocatedLamports &&
  a.feeRecipient === b.feeRecipient;

// The unsigned wire transaction: the message with its one, empty, signature slot.
function wire(messageBytes: Uint8Array, wallet: string): string {
  const bytes = getTransactionEncoder().encode({
    messageBytes: messageBytes as never,
    signatures: { [wallet]: null } as never,
  });
  return getBase64Decoder().decode(bytes);
}
const base64 = (bytes: Uint8Array) => getBase64Decoder().decode(bytes);

export function buildView(b: BuildRecord): OperatorBuildState {
  return {
    id: b.id,
    kind: b.plan.kind,
    state: b.state,
    signature: b.signature,
    expires_at: b.expiresAt.toISOString(),
  };
}

function store(
  deps: PublishDeps,
  operator: Operator,
  plan: BuildPlan,
  handoff: SignatureRequired,
): BuildRecord {
  // The build lives no longer than its blockhash: the wallet's signature is useless after it.
  return deps.builds.put({
    sessionId: operator.id,
    mint: operator.mint,
    wallet: operator.wallet,
    plan,
    messageBytes: handoff.messageBytes,
    lifetime: handoff.lifetime,
    expiresAt: new Date(Date.now() + 120_000),
  });
}

// Taken first (single use), then the signature over the stored bytes and the blockhash's age.
async function takeSigned(
  deps: PublishDeps,
  operator: Operator,
  kind: BuildPlan["kind"],
  input: { buildId: string; signature: string },
): Promise<
  | { status: "ok"; build: BuildRecord; transaction: SignedHandoff }
  | { status: "refused"; reason: "build_unknown" | "expired" | "signature_invalid" }
> {
  const taken = deps.builds.take(input.buildId, {
    sessionId: operator.id,
    mint: operator.mint,
    kind,
  });
  if (taken.status !== "ok") return taken;
  const { build } = taken;
  if (build.wallet !== operator.wallet) {
    deps.builds.finish(build, "failed", null);
    return { status: "refused", reason: "build_unknown" };
  }
  const signature = await verifiedSignature(build.messageBytes, operator.wallet, input.signature);
  if (!signature) {
    deps.builds.finish(build, "failed", null);
    return { status: "refused", reason: "signature_invalid" };
  }
  let height: bigint;
  try {
    height = await deps.blockHeight();
  } catch (error) {
    deps.builds.finish(build, "failed", null);
    throw error;
  }
  if (height > build.lifetime.lastValidBlockHeight) {
    deps.builds.finish(build, "expired", null);
    return { status: "refused", reason: "expired" };
  }
  return {
    status: "ok",
    build,
    transaction: signedTransaction(build.messageBytes, operator.wallet, signature, build.lifetime),
  };
}

const deciding = (deps: PublishDeps) => ({
  ...(deps.gate?.tests ? { tests: deps.gate.tests } : {}),
  ...(deps.gate?.clock ? { clock: deps.gate.clock } : {}),
});

// One publish or init at a time per community in this process; the planner's own locks guard
// the database across processes.
const queues = new Map<string, Promise<unknown>>();
function serial<T>(mint: string, work: () => Promise<T>): Promise<T> {
  const before = queues.get(mint) ?? Promise.resolve();
  const run = before.then(work, work);
  const settled = run.catch(() => undefined);
  queues.set(mint, settled);
  void settled.then(() => {
    if (queues.get(mint) === settled) queues.delete(mint);
  });
  return run;
}

export function buildPublish(
  db: Db,
  deps: PublishDeps,
  operator: Operator,
): Promise<OperatorPublishBuild> {
  return serial(operator.mint, async () => {
    const chain = await deps.chain(handoffSigner(operator.wallet));
    let args: PublishArgs | null = null;
    const publisher = chain.publisher;
    // The CLI run's chain, its publisher seen through: the planner's PublishArgs are kept.
    const watched: SettleChain = {
      ...chain,
      publisher: publisher && {
        address: publisher.address,
        publishEpoch: (input) => {
          args = input;
          return publisher.publishEpoch(input);
        },
      },
    };
    let out: Awaited<ReturnType<typeof operatorPublish>>;
    try {
      out = await operatorPublish(db, watched, { mint: operator.mint }, deciding(deps));
    } catch (error) {
      if (!(error instanceof SignatureRequired) || args === null) throw error;
      const planned: PublishArgs = args;
      const build = store(
        deps,
        operator,
        { kind: "publish", args: planned, epochIndex: Number(planned.index) },
        error,
      );
      deps.log?.({
        event: "operator_publish_build",
        mint: operator.mint,
        wallet: operator.wallet,
        epoch_index: Number(planned.index),
        build: build.id,
      });
      return {
        status: "awaiting_signature",
        build: { id: build.id, expires_at: build.expiresAt.toISOString() },
        transaction: wire(build.messageBytes, operator.wallet),
        message: base64(build.messageBytes),
        summary: await publishSummary(db, chain, operator, planned, build),
      };
    }
    switch (out.status) {
      case "refused":
        // no_signer cannot happen: the hand-off signer is always there.
        return {
          status: "refused",
          reason: out.reason === "no_signer" ? "publisher_not_admin" : out.reason,
        };
      case "no_policy":
        return { status: "refused", reason: "no_payout_policy" };
      case "waiting":
        return { status: "waiting", epoch_index: out.epochIndex, blockers: out.blockers };
      case "nothing_due":
        return { status: "nothing_due" };
      case "rolled_over":
        return { status: "rolled_over", epoch_index: out.epochIndex, reason: out.reason };
      case "published":
        // Only an epoch already on-chain is published without a send; the hand-off never sends.
        if (!out.recovered) throw new Error("operator: a build sent a transaction");
        return {
          status: "published",
          signature: out.signature,
          epoch_index: out.epochIndex,
          recovered: true,
        };
      case "planned":
        // operatorPublish publishes past auto_publish and has checked the signer is the admin.
        throw new Error(`operator: the planner stopped at planned (${out.reason})`);
    }
  });
}

async function publishSummary(
  db: Db,
  chain: SettleChain,
  operator: Operator,
  args: PublishArgs,
  build: BuildRecord,
): Promise<Extract<OperatorPublishBuild, { status: "awaiting_signature" }>["summary"]> {
  const [epoch] = await db
    .select({ id: epochs.id })
    .from(epochs)
    .innerJoin(communities, eq(communities.id, epochs.communityId))
    .where(and(eq(communities.mint, operator.mint), eq(epochs.index, Number(args.index))));
  const intent = epoch ? await loadDistributionIntent(db, epoch.id) : null;
  if (!intent || intent.root !== args.root || intent.auditHash !== args.auditHash) {
    throw new Error("operator: the built transaction differs from the stored intent");
  }
  const s = intent.audit.settlement;
  const a = await publishAccounts(chain.programId as Address, args);
  return {
    network: chain.network,
    program_id: chain.programId,
    epoch_index: Number(args.index),
    epochs_paid: intent.audit.epochs.length,
    gross_lamports: s.gross_lamports,
    fee_lamports: s.fee_lamports,
    fee_bps: Number(s.fee_bps),
    net_lamports: s.net_lamports,
    allocated_lamports: s.allocated_lamports,
    cap_remainder_lamports: s.cap_remainder_lamports,
    dust_lamports: s.dust_lamports,
    payable_wallets: intent.leaves.length,
    root: args.root,
    audit_hash: args.auditHash,
    accounts: {
      fee_payer: operator.wallet,
      community: a.community,
      vault: a.vault,
      fee_recipient: a.feeRecipient,
      epoch: a.epoch,
    },
    blockhash: build.lifetime.blockhash,
    last_valid_block_height: build.lifetime.lastValidBlockHeight.toString(),
    message_hash: messageHash(build.messageBytes),
  };
}

export function submitPublish(
  db: Db,
  deps: PublishDeps,
  operator: Operator,
  input: { buildId: string; signature: string },
): Promise<OperatorPublishSubmit> {
  return serial(operator.mint, async () => {
    const signed = await takeSigned(deps, operator, "publish", input);
    if (signed.status !== "ok") return signed;
    const { build, transaction } = signed;
    const plan = build.plan;
    if (plan.kind !== "publish") throw new Error("operator: a publish build without a plan");
    let sent: string | null = null;
    try {
      const read = await deps.chain();
      // The planner runs again from the database and the chain; it reaches this publisher only
      // if it sends again, and the send must be the build's, byte for byte. An epoch it finds
      // already on-chain is recorded only if it is this build's plan (review round 1, P2).
      const chain: SettleChain = {
        ...read,
        publishSignature: async (args) => {
          if (!sameArgs(args, plan.args)) throw new PlanChanged();
          // Kept before the record: a failed record still reports what is on-chain (round 2).
          sent = await read.publishSignature(args);
          return sent;
        },
        publisher: {
          address: operator.wallet,
          publishEpoch: async (args) => {
            if (!sameArgs(args, plan.args)) throw new PlanChanged();
            const again = await publishMessageBytes(
              read.programId as Address,
              operator.wallet,
              args,
              build.lifetime,
            );
            if (!sameBytes(again, build.messageBytes)) throw new PlanChanged();
            sent = await deps.send(transaction);
            return sent;
          },
        },
      };
      const out = await operatorPublish(db, chain, { mint: operator.mint }, deciding(deps));
      const result: OperatorPublishSubmit =
        out.status === "refused"
          ? {
              status: "refused",
              reason: out.reason === "no_signer" ? "publisher_not_admin" : out.reason,
            }
          : out.status === "no_policy"
            ? { status: "refused", reason: "no_payout_policy" }
            : out.status === "published" && (out.recovered || out.signature === sent)
              ? {
                  status: "published",
                  signature: out.signature,
                  epoch_index: out.epochIndex,
                  recovered: out.recovered,
                }
              : { status: "refused", reason: "plan_changed" };
      const done = result.status === "published";
      deps.builds.finish(build, done ? "done" : "failed", done ? result.signature : sent);
      deps.log?.({
        event: "operator_publish_submit",
        mint: operator.mint,
        wallet: operator.wallet,
        epoch_index: plan.epochIndex,
        build: build.id,
        outcome: done ? "published" : result.reason,
        signature: done ? result.signature : sent,
      });
      return result;
    } catch (error) {
      // A send whose confirmation failed may still land: its signature is kept and reported.
      if (error instanceof SendError) sent = error.signature;
      deps.builds.finish(build, "failed", sent);
      if (error instanceof PlanChanged) return { status: "refused", reason: "plan_changed" };
      if (error instanceof SendError) {
        deps.log?.({
          event: "operator_publish_submit",
          mint: operator.mint,
          wallet: operator.wallet,
          epoch_index: plan.epochIndex,
          build: build.id,
          outcome: "unconfirmed",
          signature: error.signature,
        });
        return { status: "unconfirmed", signature: error.signature };
      }
      throw error;
    }
  });
}

// init-community for a setup session: the record names this wallet and the fee recipient.
async function initTarget(
  db: Db,
  deps: PublishDeps,
  operator: Operator,
  feeRecipient: string,
  programId: Address,
) {
  const record = setupRecord(deps.setupRecords, operator.mint, deps.network);
  const [community] = await db
    .select({ chainAddress: communities.chainAddress })
    .from(communities)
    .where(eq(communities.mint, operator.mint));
  if (
    operator.role !== "setup" ||
    !record ||
    record.admin !== operator.wallet ||
    !community ||
    community.chainAddress !== null
  )
    return { status: "refused" as const, reason: "not_setup" as const };
  if (record.feeRecipient !== feeRecipient)
    return { status: "refused" as const, reason: "fee_recipient_mismatch" as const };
  return {
    status: "ok" as const,
    target: { programId, admin: operator.wallet, mint: operator.mint, feeRecipient },
  };
}

export function buildInit(
  db: Db,
  deps: PublishDeps,
  operator: Operator,
  input: { feeRecipient: string },
): Promise<OperatorInitBuild> {
  return serial(operator.mint, async () => {
    const signer = handoffSigner(operator.wallet);
    const sending = await deps.sending(signer);
    const checked = await initTarget(db, deps, operator, input.feeRecipient, sending.programId);
    if (checked.status !== "ok") return checked;
    const plan = await planCommunityInit(sending.rpc, checked.target);
    if (plan.status === "refused") return { status: "refused", reason: plan.reason };
    if (plan.status === "exists") return { status: "refused", reason: "community_exists" };
    let handoff: SignatureRequired;
    try {
      await sending.send(await initInstructions(checked.target, signer));
      throw new Error("operator: an init build sent a transaction");
    } catch (error) {
      if (!(error instanceof SignatureRequired)) throw error;
      handoff = error;
    }
    const build = store(
      deps,
      operator,
      {
        kind: "init",
        target: checked.target,
        community: plan.community,
        vault: plan.vault,
      },
      handoff,
    );
    deps.log?.({
      event: "operator_init_build",
      mint: operator.mint,
      wallet: operator.wallet,
      build: build.id,
    });
    return {
      status: "awaiting_signature",
      build: { id: build.id, expires_at: build.expiresAt.toISOString() },
      transaction: wire(build.messageBytes, operator.wallet),
      message: base64(build.messageBytes),
      summary: {
        network: deps.network,
        program_id: sending.programId,
        admin: operator.wallet,
        mint: operator.mint,
        community: plan.community,
        vault: plan.vault,
        fee_recipient: input.feeRecipient,
        rent_lamports: plan.rentLamports.toString(),
        admin_lamports: plan.adminLamports.toString(),
        blockhash: build.lifetime.blockhash,
        last_valid_block_height: build.lifetime.lastValidBlockHeight.toString(),
        message_hash: messageHash(build.messageBytes),
      },
    };
  });
}

export function submitInit(
  db: Db,
  deps: PublishDeps,
  operator: Operator,
  input: { buildId: string; signature: string },
): Promise<OperatorInitSubmit> {
  return serial(operator.mint, async () => {
    const signed = await takeSigned(deps, operator, "init", input);
    if (signed.status !== "ok") return signed;
    const { build, transaction } = signed;
    const stored = build.plan;
    if (stored.kind !== "init") throw new Error("operator: an init build without a target");
    let sent: string | null = null;
    try {
      const sending = await deps.sending(handoffSigner(operator.wallet));
      const checked = await initTarget(
        db,
        deps,
        operator,
        stored.target.feeRecipient,
        sending.programId,
      );
      if (checked.status !== "ok") {
        deps.builds.finish(build, "failed", null);
        return checked;
      }
      const plan = await planCommunityInit(sending.rpc, checked.target);
      if (plan.status !== "ready") {
        deps.builds.finish(build, "failed", null);
        return {
          status: "refused",
          reason: plan.status === "exists" ? "community_exists" : plan.reason,
        };
      }
      const again = await messageBytesFor(operator.wallet, build.lifetime, (payer) =>
        initInstructions(checked.target, payer),
      );
      if (
        !sameBytes(again, build.messageBytes) ||
        plan.community !== stored.community ||
        plan.vault !== stored.vault
      ) {
        deps.builds.finish(build, "failed", null);
        return { status: "refused", reason: "plan_changed" };
      }
      sent = await deps.send(transaction);
      // Read back, as the script does: the account must now name this mint, admin and fee.
      const after = await planCommunityInit(sending.rpc, checked.target);
      if (
        after.status !== "exists" ||
        after.onChain.mint !== operator.mint ||
        after.onChain.admin !== operator.wallet ||
        after.onChain.feeRecipient !== checked.target.feeRecipient
      ) {
        throw new Error(`operator: initialized in ${sent}, but the community reads otherwise`);
      }
      deps.builds.finish(build, "done", sent);
      deps.log?.({
        event: "operator_init_submit",
        mint: operator.mint,
        wallet: operator.wallet,
        build: build.id,
        outcome: "initialized",
        signature: sent,
      });
      return {
        status: "initialized",
        signature: sent,
        community: plan.community,
        vault: plan.vault,
      };
    } catch (error) {
      // A send whose confirmation failed may still land: its signature is kept and reported.
      if (error instanceof SendError) sent = error.signature;
      deps.builds.finish(build, "failed", sent);
      if (error instanceof SendError) return { status: "unconfirmed", signature: error.signature };
      throw error;
    }
  });
}
