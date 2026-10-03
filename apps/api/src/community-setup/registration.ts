import { canonicalJson, sha256Hex } from "@hyphae/core";
import { communities, type Db, epochs, rewardConfigProposals, rewardConfigs } from "@hyphae/db";
import { and, eq, or, sql } from "drizzle-orm";
import { bootstrapRewardEpochs, configDigest } from "../rewards/config.js";
import { parseSetupManifest, SetupError, type SetupManifest, setupPlan } from "./manifest.js";
import { type SetupTelegram, verifySetupTelegram } from "./telegram.js";

async function databaseTime(tx: Db): Promise<Date> {
  const time = await tx.execute(sql`select clock_timestamp() as now`);
  const rows = (Array.isArray(time) ? time : (time as { rows: unknown[] }).rows) as {
    now: Date | string;
  }[];
  const now = new Date(rows[0]?.now ?? Number.NaN);
  if (!Number.isFinite(now.getTime())) throw new SetupError("setup_unavailable");
  return now;
}

async function inspect(tx: Db, m: SetupManifest, lock = false): Promise<boolean> {
  const query = tx
    .select()
    .from(communities)
    .where(
      or(
        eq(communities.id, m.communityId),
        eq(communities.mint, m.mint),
        eq(communities.telegramChatId, BigInt(m.telegramChatId)),
      ),
    );
  const matches = await (lock ? query.for("no key update") : query);
  if (!matches.length) return false;
  const c = matches[0];
  if (
    matches.length !== 1 ||
    !c ||
    c.id !== m.communityId ||
    c.mint !== m.mint ||
    c.telegramChatId !== BigInt(m.telegramChatId) ||
    c.adminTelegramUserId !== BigInt(m.adminTelegramUserId) ||
    c.name !== m.name ||
    c.rubricVersion !== m.rewardConfig.rubric.version ||
    canonicalJson(c.rubric) !== canonicalJson(m.rewardConfig.rubric)
  )
    throw new SetupError("registration_conflict");
  const [epoch] = await tx
    .select()
    .from(epochs)
    .where(and(eq(epochs.communityId, c.id), eq(epochs.index, 1)));
  if (
    !epoch?.rewardConfigId ||
    epoch.opensAt.getTime() !== new Date(m.activationTime).getTime() ||
    epoch.closesAt.getTime() !==
      epoch.opensAt.getTime() + m.rewardConfig.epoch.durationSeconds * 1000
  )
    throw new SetupError("registration_conflict");
  const [config] = await tx
    .select()
    .from(rewardConfigs)
    .where(and(eq(rewardConfigs.id, epoch.rewardConfigId), eq(rewardConfigs.communityId, c.id)));
  const proposals = await tx
    .select()
    .from(rewardConfigProposals)
    .where(
      and(
        eq(rewardConfigProposals.communityId, c.id),
        eq(rewardConfigProposals.activatedEpochIndex, 1),
      ),
    );
  if (
    !config ||
    config.digest !== configDigest(m.rewardConfig) ||
    canonicalJson(config.payload) !== canonicalJson(m.rewardConfig) ||
    proposals.length !== 1 ||
    proposals[0]?.proposedBy !== `setup:${m.approvalReference}:${setupPlan(m).hash}`
  )
    throw new SetupError("registration_conflict");
  return true;
}

export async function checkCommunitySetup(db: Db, input: SetupManifest, api: SetupTelegram) {
  const m = parseSetupManifest(input);
  await verifySetupTelegram(m, api);
  try {
    const exists = await db.transaction(
      async (tx) => {
        const found = await inspect(tx, m);
        if (!found && new Date(m.activationTime).getTime() <= (await databaseTime(tx)).getTime())
          throw new SetupError("activation_not_future");
        return found;
      },
      {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      },
    );
    return {
      status: exists ? "existing" : "ready",
      communityId: m.communityId,
      planHash: setupPlan(m).hash,
    };
  } catch (error) {
    if (error instanceof SetupError) throw error;
    throw new SetupError("setup_unavailable");
  }
}

export async function applyCommunitySetup(
  db: Db,
  input: SetupManifest,
  approvedHash: string,
  api: SetupTelegram,
) {
  const m = parseSetupManifest(input);
  const plan = setupPlan(m);
  if (approvedHash !== plan.hash) throw new SetupError("plan_mismatch");
  await verifySetupTelegram(m, api);
  try {
    return await db.transaction(async (tx) => {
      // Sorted resource locks serialize overlapping IDs/mints/chats, including identical
      // concurrent requests. Unique constraints remain the backstop for unrelated writers.
      const keys = [`id:${m.communityId}`, `mint:${m.mint}`, `chat:${m.telegramChatId}`]
        .map((key) =>
          BigInt.asIntN(64, BigInt(`0x${sha256Hex(`hyphae:setup:${key}`).slice(0, 16)}`)),
        )
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      for (const key of keys)
        await tx.execute(sql`select pg_advisory_xact_lock(${key.toString()}::bigint)`);
      if (await inspect(tx, m, true))
        return { status: "existing", communityId: m.communityId, planHash: plan.hash };
      const now = await databaseTime(tx);
      const opensAt = new Date(m.activationTime);
      if (opensAt.getTime() <= now.getTime()) throw new SetupError("activation_not_future");
      await tx.insert(communities).values({
        id: m.communityId,
        mint: m.mint,
        name: m.name,
        telegramChatId: BigInt(m.telegramChatId),
        adminTelegramUserId: BigInt(m.adminTelegramUserId),
        rubricVersion: m.rewardConfig.rubric.version,
        rubric: m.rewardConfig.rubric,
        rewardIntakePausedAt: now,
      });
      // No community can become visible without its pinned epoch. Otherwise /submit would
      // select the legacy scoring path, which is not a paused reward onboarding state.
      await bootstrapRewardEpochs(tx, {
        communityId: m.communityId,
        payload: m.rewardConfig,
        opensAt,
        proposedBy: `setup:${m.approvalReference}:${plan.hash}`,
      });
      return { status: "created", communityId: m.communityId, planHash: plan.hash };
    });
  } catch (error) {
    if (error instanceof SetupError) throw error;
    // A lost COMMIT acknowledgement cannot safely be reported as rollback. Reconcile the
    // approved manifest with check; never automatically retry or print DB exception text.
    throw new SetupError("setup_outcome_unknown");
  }
}
