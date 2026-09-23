import { randomUUID } from "node:crypto";
import {
  canonicalJson,
  EFFORT_CRITERIA_V1,
  MAX_WHOLE_POINTS,
  POINT_UNITS_PER_POINT,
  promptTemplateHash,
  REWARD_CREDIT_FLOOR,
  REWARD_PROMPT_VERSION,
  type Rubric,
  RubricSchema,
  sha256Hex,
} from "@hyphae/core";
import { communities, type Db, epochs, rewardConfigProposals, rewardConfigs } from "@hyphae/db";
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { z } from "zod";

// Pinned reward configuration (O4). The bundle is complete so reward work never reads
// mutable community settings. Credit and points fields must equal the R1 constants: a
// different gate needs an R1 change and a fresh activation, never a config edit. Version 2 pins
// the evaluation prompt; no version 1 bundle was ever stored outside test databases.
const MINUTE_MS = 60_000;
// O2's attempt bounds; the slot and retrieval tables enforce the same ceiling.
const MAX_CANDIDATES_PER_SLOT = 3;
const MAX_RETRIEVAL_ROUNDS = 3;

export const RewardConfigPayload = z
  .object({
    version: z.literal(2),
    rubric: RubricSchema,
    scoring: z.object({
      promptVersion: z.string().min(1),
      promptTemplateHash: z
        .string()
        .regex(/^[0-9a-f]{64}$/, "promptTemplateHash must be sha256 hex"),
    }),
    epoch: z.object({ durationSeconds: z.number().int().positive() }),
    timing: z.object({
      fullCreditUntilMs: z.number().int().nonnegative(),
      zeroCreditAtMs: z.number().int().positive(),
    }),
    credit: z.object({
      floor: z.literal(Number(REWARD_CREDIT_FLOOR)),
      aiCapMild: z.literal(79),
      aiCapStrong: z.literal(40),
      hardZeroFlags: z.tuple([
        z.literal("guideline_breach"),
        z.literal("spam"),
        z.literal("off_topic"),
      ]),
    }),
    effort: z.object({
      multiplierBps: z.number().int().min(10_000),
      slotLimit: z.number().int().positive(),
      candidatesPerSlot: z.number().int().positive().max(MAX_CANDIDATES_PER_SLOT),
      retrievalRounds: z.number().int().positive().max(MAX_RETRIEVAL_ROUNDS),
      criteria: z.string().min(20),
    }),
    points: z.object({
      unitsPerPoint: z.literal(POINT_UNITS_PER_POINT.toString()),
      rounding: z.literal("half_up_after_aggregation"),
      maxWholePoints: z.literal(MAX_WHOLE_POINTS.toString()),
    }),
  })
  .superRefine((p, ctx) => {
    if (p.timing.fullCreditUntilMs !== p.rubric.timing.fullUntil * MINUTE_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["timing", "fullCreditUntilMs"],
        message: "timing.fullCreditUntilMs must equal rubric.timing.fullUntil in milliseconds",
      });
    }
    if (p.timing.zeroCreditAtMs !== p.rubric.timing.zeroAt * MINUTE_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["timing", "zeroCreditAtMs"],
        message: "timing.zeroCreditAtMs must equal rubric.timing.zeroAt in milliseconds",
      });
    }
    if (p.timing.zeroCreditAtMs <= p.timing.fullCreditUntilMs) {
      ctx.addIssue({
        code: "custom",
        path: ["timing", "zeroCreditAtMs"],
        message: "timing.zeroCreditAtMs must exceed timing.fullCreditUntilMs",
      });
    }
  });
export type RewardConfigPayload = z.infer<typeof RewardConfigPayload>;

export const DEFAULT_REWARD_POLICY = {
  epoch: { durationSeconds: 604_800 },
  effort: {
    multiplierBps: 30_000,
    slotLimit: 1,
    candidatesPerSlot: MAX_CANDIDATES_PER_SLOT,
    retrievalRounds: MAX_RETRIEVAL_ROUNDS,
    criteria: EFFORT_CRITERIA_V1,
  },
} as const;

export interface RewardPolicyOverrides {
  epoch?: Partial<RewardConfigPayload["epoch"]>;
  effort?: Partial<RewardConfigPayload["effort"]>;
}

function currentPromptPin(): RewardConfigPayload["scoring"] {
  const hash = promptTemplateHash(REWARD_PROMPT_VERSION);
  if (!hash) throw new Error(`reward: prompt ${REWARD_PROMPT_VERSION} is not registered`);
  return { promptVersion: REWARD_PROMPT_VERSION, promptTemplateHash: hash };
}

export function buildRewardConfigPayload(
  rubric: Rubric,
  overrides: RewardPolicyOverrides = {},
): RewardConfigPayload {
  return RewardConfigPayload.parse({
    version: 2,
    rubric,
    scoring: currentPromptPin(),
    epoch: { ...DEFAULT_REWARD_POLICY.epoch, ...overrides.epoch },
    timing: {
      fullCreditUntilMs: rubric.timing.fullUntil * MINUTE_MS,
      zeroCreditAtMs: rubric.timing.zeroAt * MINUTE_MS,
    },
    credit: {
      floor: Number(REWARD_CREDIT_FLOOR),
      aiCapMild: 79,
      aiCapStrong: 40,
      hardZeroFlags: ["guideline_breach", "spam", "off_topic"],
    },
    effort: { ...DEFAULT_REWARD_POLICY.effort, ...overrides.effort },
    points: {
      unitsPerPoint: POINT_UNITS_PER_POINT.toString(),
      rounding: "half_up_after_aggregation",
      maxWholePoints: MAX_WHOLE_POINTS.toString(),
    },
  });
}

// Internal identity for deduplication and the no-op check. Not the O7 configuration hash:
// rubric weights are still floats here, which the commitment canonicalization forbids.
export const configDigest = (payload: RewardConfigPayload): string =>
  sha256Hex(canonicalJson(payload));

// O4 cooldown: a proposal accepted during E(k) with the last activation at E(a) activates no
// earlier than E(max(k+1, a+2)). Bootstrap counts as an activation at E1; k = 0 before E1 opens.
export const earliestActivationEpoch = (acceptedInEpoch: number, lastActivation: number): number =>
  Math.max(acceptedInEpoch + 1, lastActivation + 2);

// The next epoch opens exactly at the previous close; the new epoch's own duration sets its close.
export function nextWindow(
  previous: { closesAt: Date },
  durationSeconds: number,
): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: previous.closesAt,
    closesAt: new Date(previous.closesAt.getTime() + durationSeconds * 1000),
  };
}

// Bootstrap takes a UTC boundary. A value without a zone would be read in the host's local time,
// so only `Z` or an explicit offset is accepted.
const ZONED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseActivationTime(value: string): Date {
  if (!ZONED_ISO.test(value)) {
    throw new Error(
      `activation time must be an ISO 8601 timestamp with Z or an explicit UTC offset, got "${value}"`,
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`activation time is not a valid instant, got "${value}"`);
  }
  return date;
}

export type Community = typeof communities.$inferSelect;
export type Epoch = typeof epochs.$inferSelect;
export type RewardConfig = typeof rewardConfigs.$inferSelect;
export type RewardProposal = typeof rewardConfigProposals.$inferSelect;

export type Clock = (db: Db, communityId: string) => Promise<Date>;
export interface RewardDeps {
  clock?: Clock;
}

// Database time at millisecond precision, read only after the community lock is held.
export const dbClock: Clock = async (db, communityId) => {
  const [row] = await db
    .select({
      ms: sql<number>`floor(extract(epoch from clock_timestamp()) * 1000)::double precision`,
    })
    .from(communities)
    .where(eq(communities.id, communityId));
  if (!row) throw new Error(`reward: community ${communityId} missing`);
  return new Date(row.ms);
};

// Every reward write serializes on the community row and takes its timestamp afterwards, so
// acceptance order equals commit order per community (O3 durable acceptance). NO KEY UPDATE
// excludes other reward writers but not the KEY SHARE that foreign-key inserts (/link, /raid,
// legacy /submit) take on the same row.
export async function withCommunityLock<T>(
  db: Db,
  communityId: string,
  deps: RewardDeps,
  fn: (tx: Db, community: Community, now: Date) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const [community] = await tx
      .select()
      .from(communities)
      .where(eq(communities.id, communityId))
      .for("no key update");
    if (!community) throw new Error(`reward: community ${communityId} missing`);
    const now = await (deps.clock ?? dbClock)(tx, communityId);
    return fn(tx, community, now);
  });
}

export async function latestEpoch(tx: Db, communityId: string): Promise<Epoch | undefined> {
  const [row] = await tx
    .select()
    .from(epochs)
    .where(eq(epochs.communityId, communityId))
    .orderBy(desc(epochs.index))
    .limit(1);
  return row;
}

async function pendingProposal(tx: Db, communityId: string): Promise<RewardProposal | undefined> {
  const [row] = await tx
    .select()
    .from(rewardConfigProposals)
    .where(
      and(
        eq(rewardConfigProposals.communityId, communityId),
        eq(rewardConfigProposals.status, "pending"),
      ),
    );
  return row;
}

async function lastActivation(tx: Db, communityId: string): Promise<number> {
  const [row] = await tx
    .select({ index: rewardConfigProposals.activatedEpochIndex })
    .from(rewardConfigProposals)
    .where(
      and(
        eq(rewardConfigProposals.communityId, communityId),
        eq(rewardConfigProposals.status, "activated"),
      ),
    )
    .orderBy(desc(rewardConfigProposals.activatedEpochIndex))
    .limit(1);
  if (row?.index === undefined || row.index === null) {
    throw new Error("reward: no activated configuration");
  }
  return row.index;
}

async function findOrInsertConfig(
  tx: Db,
  communityId: string,
  payload: RewardConfigPayload,
): Promise<RewardConfig> {
  const parsed = RewardConfigPayload.parse(payload);
  const digest = configDigest(parsed);
  const [existing] = await tx
    .select()
    .from(rewardConfigs)
    .where(and(eq(rewardConfigs.communityId, communityId), eq(rewardConfigs.digest, digest)));
  if (existing) return existing;
  const [row] = await tx
    .insert(rewardConfigs)
    .values({ communityId, payloadVersion: parsed.version, payload: parsed, digest })
    .returning();
  if (!row) throw new Error("reward: config insert returned nothing");
  return row;
}

async function durationOf(tx: Db, configId: string): Promise<number> {
  const [row] = await tx
    .select({ payload: rewardConfigs.payload })
    .from(rewardConfigs)
    .where(eq(rewardConfigs.id, configId));
  if (!row) throw new Error(`reward: config ${configId} missing`);
  return RewardConfigPayload.parse(row.payload).epoch.durationSeconds;
}

// Materializes epochs contiguously until the one containing `t` exists, pinning at each new
// boundary the pending proposal whose earliest activation has arrived, else the previous
// config. Never opens an epoch after `t`. Returns null when `t` precedes epoch 1 or no epoch
// exists. Callers hold the community lock.
export async function ensureEpochAt(
  tx: Db,
  communityId: string,
  t: Date,
  now: Date,
): Promise<Epoch | null> {
  const latest = await latestEpoch(tx, communityId);
  if (!latest) return null;
  let last: Epoch = latest;
  while (last.closesAt.getTime() <= t.getTime()) {
    if (!last.rewardConfigId) {
      throw new Error("reward: a legacy epoch without a pinned configuration cannot be extended");
    }
    const index = last.index + 1;
    const pending = await pendingProposal(tx, communityId);
    const activate = pending !== undefined && pending.earliestActivationEpoch <= index;
    const configId = activate && pending ? pending.configId : last.rewardConfigId;
    const window = nextWindow(last, await durationOf(tx, configId));
    const [created] = await tx
      .insert(epochs)
      .values({ communityId, index, ...window, rewardConfigId: configId })
      .returning();
    if (!created) throw new Error("reward: epoch insert returned nothing");
    if (activate && pending) {
      await tx
        .update(rewardConfigProposals)
        .set({
          status: "activated",
          activatedEpochIndex: index,
          resolvedAt: now,
          resolvedReason: `activated at epoch ${index}`,
        })
        .where(eq(rewardConfigProposals.id, pending.id));
    }
    last = created;
  }
  if (last.opensAt.getTime() <= t.getTime()) return last;
  const [containing] = await tx
    .select()
    .from(epochs)
    .where(
      and(eq(epochs.communityId, communityId), lte(epochs.opensAt, t), gt(epochs.closesAt, t)),
    );
  return containing ?? null;
}

export async function materializeEpochs(
  db: Db,
  input: { communityId: string },
  deps: RewardDeps = {},
): Promise<Epoch> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const epoch = await ensureEpochAt(tx, input.communityId, now, now);
    if (!epoch) throw new Error("reward: no epoch contains the current time; bootstrap first");
    return epoch;
  });
}

export interface BootstrapInput {
  communityId: string;
  payload: RewardConfigPayload;
  opensAt: Date;
  proposedBy: string;
}

// First activation: epoch 1 opens at an explicit future whole-second boundary. Counts as a = 1.
export async function bootstrapRewardEpochs(
  db: Db,
  input: BootstrapInput,
  deps: RewardDeps = {},
): Promise<{ config: RewardConfig; proposal: RewardProposal; epoch: Epoch }> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    if (await latestEpoch(tx, input.communityId)) {
      throw new Error("reward: community already has epochs; propose a configuration instead");
    }
    if (input.opensAt.getTime() <= now.getTime()) {
      throw new Error("reward: opensAt must be in the future");
    }
    if (input.opensAt.getTime() % 1000 !== 0) {
      throw new Error("reward: opensAt must be a whole second");
    }
    const config = await findOrInsertConfig(tx, input.communityId, input.payload);
    const [proposal] = await tx
      .insert(rewardConfigProposals)
      .values({
        communityId: input.communityId,
        configId: config.id,
        proposedBy: input.proposedBy,
        acceptedAt: now,
        acceptedInEpoch: null,
        earliestActivationEpoch: 1,
        status: "activated",
        activatedEpochIndex: 1,
        resolvedAt: now,
        resolvedReason: "bootstrap",
      })
      .returning();
    if (!proposal) throw new Error("reward: proposal insert returned nothing");
    const duration = RewardConfigPayload.parse(config.payload).epoch.durationSeconds;
    const [epoch] = await tx
      .insert(epochs)
      .values({
        communityId: input.communityId,
        index: 1,
        opensAt: input.opensAt,
        closesAt: new Date(input.opensAt.getTime() + duration * 1000),
        rewardConfigId: config.id,
      })
      .returning();
    if (!epoch) throw new Error("reward: epoch insert returned nothing");
    return { config, proposal, epoch };
  });
}

export interface ProposeInput {
  communityId: string;
  payload: RewardConfigPayload;
  proposedBy: string;
}

export async function proposeRewardConfig(
  db: Db,
  input: ProposeInput,
  deps: RewardDeps = {},
): Promise<RewardProposal> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const last = await latestEpoch(tx, input.communityId);
    if (!last) throw new Error("reward: community has no epochs; bootstrap first");
    const current = await ensureEpochAt(tx, input.communityId, now, now);
    // Before epoch 1 opens, k = 0 and the config about to open is the pinned one.
    const acceptedInEpoch = current?.index ?? 0;
    const pinned = current ?? last;
    const config = await findOrInsertConfig(tx, input.communityId, input.payload);
    if (pinned.rewardConfigId === config.id) {
      throw new Error("reward: this configuration is already pinned; nothing to propose");
    }
    const pending = await pendingProposal(tx, input.communityId);
    if (pending?.configId === config.id) {
      throw new Error("reward: this configuration is already pending; nothing to propose");
    }
    const earliest = earliestActivationEpoch(
      acceptedInEpoch,
      await lastActivation(tx, input.communityId),
    );
    const id = randomUUID();
    if (pending) {
      await tx
        .update(rewardConfigProposals)
        .set({ status: "superseded", resolvedAt: now, resolvedReason: `superseded by ${id}` })
        .where(eq(rewardConfigProposals.id, pending.id));
    }
    const [row] = await tx
      .insert(rewardConfigProposals)
      .values({
        id,
        communityId: input.communityId,
        configId: config.id,
        proposedBy: input.proposedBy,
        acceptedAt: now,
        acceptedInEpoch,
        earliestActivationEpoch: earliest,
        status: "pending",
      })
      .returning();
    if (!row) throw new Error("reward: proposal insert returned nothing");
    return row;
  });
}

export async function cancelRewardProposal(
  db: Db,
  input: { communityId: string },
  deps: RewardDeps = {},
): Promise<RewardProposal> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const pending = await pendingProposal(tx, input.communityId);
    if (!pending) throw new Error("reward: no pending proposal to cancel");
    const [row] = await tx
      .update(rewardConfigProposals)
      .set({ status: "cancelled", resolvedAt: now, resolvedReason: "cancelled" })
      .where(eq(rewardConfigProposals.id, pending.id))
      .returning();
    if (!row) throw new Error("reward: proposal update returned nothing");
    return row;
  });
}

export async function setRewardIntakePaused(
  db: Db,
  input: { communityId: string; paused: boolean },
  deps: RewardDeps = {},
): Promise<Date | null> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const rewardIntakePausedAt = input.paused ? now : null;
    await tx
      .update(communities)
      .set({ rewardIntakePausedAt })
      .where(eq(communities.id, input.communityId));
    return rewardIntakePausedAt;
  });
}
