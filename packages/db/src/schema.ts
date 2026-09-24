import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const communities = pgTable("communities", {
  id: id(),
  mint: text("mint").notNull().unique(),
  name: text("name").notNull(),
  telegramChatId: bigint("telegram_chat_id", { mode: "bigint" }).notNull().unique(),
  adminTelegramUserId: bigint("admin_telegram_user_id", { mode: "bigint" }).notNull(),
  rubricVersion: text("rubric_version").notNull(),
  rubric: jsonb("rubric").notNull(),
  publisherPubkey: text("publisher_pubkey"),
  chainAddress: text("chain_address"),
  // Explicit reward intake pause (O4): null means intake is allowed. Epochs keep their schedule.
  rewardIntakePausedAt: timestamp("reward_intake_paused_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const linkMethod = pgEnum("link_method", ["paste", "signature"]);

export const members = pgTable(
  "members",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
    telegramUsername: text("telegram_username"),
    wallet: text("wallet").notNull(),
    // X accounts this member has submitted from; bound on first sight, max 3 (see bindHandle).
    xHandles: jsonb("x_handles").$type<string[]>().notNull().default([]),
    linkMethod: linkMethod("link_method").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("members_community_tg").on(t.communityId, t.telegramUserId),
    uniqueIndex("members_community_wallet").on(t.communityId, t.wallet),
  ],
);

export const taskKind = pgEnum("task_kind", ["raid", "open"]);
export const taskStatus = pgEnum("task_status", ["proposed", "rejected", "open", "closed"]);

export const tasks = pgTable("tasks", {
  id: id(),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.id),
  kind: taskKind("kind").notNull(),
  status: taskStatus("status").notNull(),
  targetUrl: text("target_url"),
  targetText: text("target_text"),
  targetAuthor: text("target_author"),
  brief: text("brief").notNull().default(""),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  proposedBy: uuid("proposed_by").references(() => members.id),
  proposalScore: integer("proposal_score"),
  proposalReasoning: text("proposal_reasoning"),
  telegramMessageId: integer("telegram_message_id"),
  createdAt: createdAt(),
});

export const contributionKind = pgEnum("contribution_kind", ["reply", "quote", "post", "text"]);

// Append-only. Never UPDATE; a correction is a new row.
export const contributions = pgTable(
  "contributions",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    taskId: uuid("task_id").references(() => tasks.id),
    kind: contributionKind("kind").notNull(),
    url: text("url"),
    text: text("text").notNull(),
    oembed: jsonb("oembed"),
    telegramMessageId: integer("telegram_message_id").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contributions_community_submitted").on(t.communityId, t.submittedAt)],
);

// Append-only. One row per model call; the audit page reads this.
export const scoringRuns = pgTable("scoring_runs", {
  id: id(),
  contributionId: uuid("contribution_id")
    .notNull()
    .references(() => contributions.id),
  model: text("model").notNull(),
  rubricVersion: text("rubric_version").notNull(),
  promptHash: text("prompt_hash").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output").notNull(),
  score: integer("score").notNull(),
  timingMultiplier: integer("timing_multiplier_bps").notNull(), // 0–10000
  flags: jsonb("flags").notNull(),
  reasoning: text("reasoning").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  costMicroUsd: integer("cost_micro_usd").notNull(),
  evidenceHash: text("evidence_hash").notNull().unique(),
  createdAt: createdAt(),
});

export const epochStatus = pgEnum("epoch_status", ["open", "closed", "published"]);

export const epochs = pgTable(
  "epochs",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    index: integer("index").notNull(),
    status: epochStatus("status").notNull().default("open"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    root: text("root"),
    potLamports: bigint("pot_lamports", { mode: "bigint" }),
    rubricHash: text("rubric_hash"),
    publishTx: text("publish_tx"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // The pinned reward configuration. Null marks a legacy epoch that cannot admit reward intake.
    rewardConfigId: uuid("reward_config_id").references(() => rewardConfigs.id),
  },
  (t) => [uniqueIndex("epochs_community_index").on(t.communityId, t.index)],
);

export const leaves = pgTable(
  "leaves",
  {
    id: id(),
    epochId: uuid("epoch_id")
      .notNull()
      .references(() => epochs.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    wallet: text("wallet").notNull(),
    score: bigint("score", { mode: "bigint" }).notNull(),
    amountLamports: bigint("amount_lamports", { mode: "bigint" }).notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    proof: jsonb("proof").notNull(), // hex[] sibling hashes
    claimTx: text("claim_tx"),
  },
  (t) => [uniqueIndex("leaves_epoch_wallet").on(t.epochId, t.wallet)],
);

// Immutable reward configuration bundles (O4). Insert-only.
export const rewardConfigs = pgTable(
  "reward_configs",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    payloadVersion: integer("payload_version").notNull(),
    payload: jsonb("payload").notNull(),
    // Internal digest of the versioned canonical payload. Not the O7 configuration hash.
    digest: text("digest").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reward_configs_community_digest").on(t.communityId, t.digest)],
);

export const rewardProposalStatus = pgEnum("reward_proposal_status", [
  "pending",
  "activated",
  "superseded",
  "cancelled",
]);

// Proposal and activation history (O4). A row changes status once; its values never change.
export const rewardConfigProposals = pgTable(
  "reward_config_proposals",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    configId: uuid("config_id")
      .notNull()
      .references(() => rewardConfigs.id),
    proposedBy: text("proposed_by").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    acceptedInEpoch: integer("accepted_in_epoch"), // null only for the bootstrap activation
    earliestActivationEpoch: integer("earliest_activation_epoch").notNull(),
    status: rewardProposalStatus("status").notNull(),
    activatedEpochIndex: integer("activated_epoch_index"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedReason: text("resolved_reason"),
  },
  (t) => [
    uniqueIndex("reward_config_proposals_one_pending")
      .on(t.communityId)
      .where(sql`${t.status} = 'pending'`),
    index("reward_config_proposals_community_accepted").on(t.communityId, t.acceptedAt),
  ],
);

// Immutable reward intake (O2/O3): one row per admitted contribution. Insert-only. A re-entry
// (O3) is a new row in a later epoch for the same artifact, pointing at the original intake.
export const rewardIntakes = pgTable(
  "reward_intakes",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    epochId: uuid("epoch_id")
      .notNull()
      .references(() => epochs.id),
    configId: uuid("config_id")
      .notNull()
      .references(() => rewardConfigs.id),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id),
    taskId: uuid("task_id").references(() => tasks.id),
    artifactKey: text("artifact_key").notNull(), // "x:status:<id>" or "text:sha256:<hex>"
    idempotencyKey: text("idempotency_key").notNull(), // "tg:<chat_id>:<message_id>"
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    capture: jsonb("capture").notNull(),
    reentryOf: uuid("reentry_of").references((): AnyPgColumn => rewardIntakes.id),
  },
  (t) => [
    uniqueIndex("reward_intakes_contribution").on(t.contributionId),
    uniqueIndex("reward_intakes_community_artifact")
      .on(t.communityId, t.artifactKey)
      .where(sql`${t.reentryOf} is null`),
    uniqueIndex("reward_intakes_epoch_artifact").on(t.epochId, t.artifactKey),
    uniqueIndex("reward_intakes_community_idempotency").on(t.communityId, t.idempotencyKey),
    index("reward_intakes_epoch_member").on(t.epochId, t.memberId),
  ],
);

// Effort slots (O2). One row per (epoch, member, ordinal); counters only ever grow, and the
// generation is the fence a dispatch must still hold to complete.
export const rewardSlotState = pgEnum("reward_slot_state", ["open", "reserved", "consumed"]);

export const rewardSlots = pgTable(
  "reward_slots",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    epochId: uuid("epoch_id")
      .notNull()
      .references(() => epochs.id),
    ordinal: integer("ordinal").notNull(),
    state: rewardSlotState("state").notNull().default("open"),
    generation: integer("generation").notNull().default(0),
    candidatesUsed: integer("candidates_used").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedDecisionId: uuid("consumed_decision_id").references(
      (): AnyPgColumn => rewardDecisions.id,
    ),
  },
  (t) => [
    uniqueIndex("reward_slots_epoch_member_ordinal").on(t.epochId, t.memberId, t.ordinal),
    check("reward_slots_ordinal_positive", sql`${t.ordinal} >= 1`),
    check("reward_slots_candidates_bound", sql`${t.candidatesUsed} between 0 and 3`),
  ],
);

export const rewardNominationKind = pgEnum("reward_nomination_kind", ["new_work", "upgrade"]);
export const rewardNominationState = pgEnum("reward_nomination_state", [
  "pending_evidence",
  "ready",
  "evaluating",
  "pending_reconciliation",
  "completed_eligible",
  "completed_ineligible",
  "withdrawn",
  "expired_at_close",
  "completed_after_cutoff",
]);

// Explicit effort nominations (O2): the candidates of a slot.
export const rewardNominations = pgTable(
  "reward_nominations",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    epochId: uuid("epoch_id")
      .notNull()
      .references(() => epochs.id),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => rewardSlots.id),
    candidateOrdinal: integer("candidate_ordinal").notNull(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id),
    intakeId: uuid("intake_id")
      .notNull()
      .references(() => rewardIntakes.id),
    kind: rewardNominationKind("kind").notNull(),
    state: rewardNominationState("state").notNull(),
    pendingReason: text("pending_reason"),
    idempotencyKey: text("idempotency_key").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("reward_nominations_slot_candidate").on(t.slotId, t.candidateOrdinal),
    uniqueIndex("reward_nominations_community_idempotency").on(t.communityId, t.idempotencyKey),
    uniqueIndex("reward_nominations_one_live")
      .on(t.contributionId)
      .where(sql`${t.state} <> 'withdrawn'`),
    check("reward_nominations_candidate_bound", sql`${t.candidateOrdinal} between 1 and 3`),
  ],
);

// Free evidence retrieval rounds per artifact and epoch (O2). Round 1 is the admission capture.
export const rewardRetrievals = pgTable(
  "reward_retrievals",
  {
    id: id(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id),
    epochId: uuid("epoch_id")
      .notNull()
      .references(() => epochs.id),
    round: integer("round").notNull(),
    outcome: text("outcome").notNull(), // "complete" or the essential gap
    limitations: jsonb("limitations").$type<string[]>().notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("reward_retrievals_contribution_epoch_round").on(
      t.contributionId,
      t.epochId,
      t.round,
    ),
    check("reward_retrievals_round_bound", sql`${t.round} between 1 and 3`),
  ],
);

export const rewardDispatchPurpose = pgEnum("reward_dispatch_purpose", [
  "quality",
  "quality_effort",
  "effort",
]);
export const rewardDispatchState = pgEnum("reward_dispatch_state", [
  "dispatched",
  "completed",
  "pending_reconciliation",
  "not_sent_proven",
]);

// Possibly billable model calls (O2). The row is committed before the call, so its existence
// means "may have been sent"; only an operator record of proven non-dispatch frees the budget.
export const rewardDispatches = pgTable(
  "reward_dispatches",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id),
    nominationId: uuid("nomination_id").references(() => rewardNominations.id),
    slotId: uuid("slot_id").references(() => rewardSlots.id),
    purpose: rewardDispatchPurpose("purpose").notNull(),
    fence: integer("fence").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    state: rewardDispatchState("state").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    promptHash: text("prompt_hash").notNull(),
    inputHash: text("input_hash").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output"),
    outputHash: text("output_hash"),
    latencyMs: integer("latency_ms"),
    costMicroUsd: integer("cost_micro_usd"),
    error: text("error"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    reconcileReason: text("reconcile_reason"),
  },
  (t) => [
    uniqueIndex("reward_dispatches_one_per_slot")
      .on(t.slotId)
      .where(sql`${t.state} <> 'not_sent_proven'`),
    uniqueIndex("reward_dispatches_one_quality")
      .on(t.contributionId)
      .where(sql`${t.purpose} = 'quality' and ${t.state} <> 'not_sent_proven'`),
  ],
);

export const rewardEffort = pgEnum("reward_effort", ["eligible", "ineligible", "not_nominated"]);

// Completed reward decisions (O6). A linear lineage per contribution: revision 1 has no
// predecessor, each later revision names exactly one, and no predecessor has two successors.
export const rewardDecisions = pgTable(
  "reward_decisions",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id),
    epochId: uuid("epoch_id")
      .notNull()
      .references(() => epochs.id),
    configId: uuid("config_id")
      .notNull()
      .references(() => rewardConfigs.id),
    revision: integer("revision").notNull(),
    predecessorId: uuid("predecessor_id").references((): AnyPgColumn => rewardDecisions.id),
    dispatchId: uuid("dispatch_id").references(() => rewardDispatches.id),
    nominationId: uuid("nomination_id").references(() => rewardNominations.id),
    rawQuality: integer("raw_quality").notNull(),
    creditedQuality: integer("credited_quality").notNull(),
    flags: jsonb("flags").notNull(),
    effort: rewardEffort("effort").notNull(),
    effortCriteria: jsonb("effort_criteria"),
    timingBps: integer("timing_bps").notNull(),
    multiplierBps: integer("multiplier_bps").notNull(),
    pointUnits: bigint("point_units", { mode: "bigint" }).notNull(),
    explanation: text("explanation").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    // accepted_at < the origin epoch's closesAt, decided under the community lock (O3).
    affectsAllocation: boolean("affects_allocation").notNull(),
    // Set after Telegram accepts the member's message; null past the grace means it was lost.
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    // Operator correction audit (O6): all three set on a correction row, all null otherwise.
    correctionActor: text("correction_actor"),
    correctionReason: text("correction_reason"),
    correctionEvidence: jsonb("correction_evidence").$type<string[]>(),
    idempotencyKey: text("idempotency_key"),
  },
  (t) => [
    uniqueIndex("reward_decisions_contribution_revision").on(t.contributionId, t.revision),
    uniqueIndex("reward_decisions_predecessor").on(t.predecessorId),
    uniqueIndex("reward_decisions_community_idempotency")
      .on(t.communityId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    check("reward_decisions_revision_positive", sql`${t.revision} >= 1`),
    check(
      "reward_decisions_correction_complete",
      sql`(${t.correctionActor} is null) = (${t.correctionReason} is null) and (${t.correctionActor} is null) = (${t.correctionEvidence} is null)`,
    ),
    // A correction has a predecessor and no model dispatch of its own.
    check(
      "reward_decisions_correction_shape",
      sql`${t.correctionActor} is null or (${t.predecessorId} is not null and ${t.dispatchId} is null)`,
    ),
  ],
);

// The frozen close of one epoch (O3/O6). Insert-only; written once, under the community lock.
export const rewardEpochSnapshots = pgTable("reward_epoch_snapshots", {
  id: id(),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.id),
  epochId: uuid("epoch_id")
    .notNull()
    .unique()
    .references(() => epochs.id),
  // The scheduled cutoff; the close itself may run later.
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
  cutoffAssumption: text("cutoff_assumption").notNull(),
});

export const rewardSnapshotReason = pgEnum("reward_snapshot_reason", [
  "pending_at_close",
  "pending_reconciliation",
  "excluded",
]);

// Every admitted contribution of the epoch: its selected decision, or why it has none.
export const rewardSnapshotEntries = pgTable(
  "reward_snapshot_entries",
  {
    id: id(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => rewardEpochSnapshots.id),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    decisionId: uuid("decision_id").references(() => rewardDecisions.id),
    revision: integer("revision"),
    reason: rewardSnapshotReason("reason"),
    pointUnits: bigint("point_units", { mode: "bigint" }).notNull(),
  },
  (t) => [
    uniqueIndex("reward_snapshot_entries_snapshot_contribution").on(t.snapshotId, t.contributionId),
    index("reward_snapshot_entries_contribution").on(t.contributionId),
    check(
      "reward_snapshot_entries_selected_or_reason",
      sql`(${t.decisionId} is null) = (${t.revision} is null) and (${t.decisionId} is null) <> (${t.reason} is null) and (${t.reason} is null or ${t.pointUnits} = 0)`,
    ),
  ],
);

// Per-member totals (O5): exact units summed, whole points rounded once after aggregation.
export const rewardSnapshotMembers = pgTable(
  "reward_snapshot_members",
  {
    id: id(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => rewardEpochSnapshots.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    pointUnits: bigint("point_units", { mode: "bigint" }).notNull(),
    wholePoints: bigint("whole_points", { mode: "bigint" }).notNull(),
  },
  (t) => [
    uniqueIndex("reward_snapshot_members_snapshot_member").on(t.snapshotId, t.memberId),
    index("reward_snapshot_members_member").on(t.memberId),
    check(
      "reward_snapshot_members_nonnegative",
      sql`${t.pointUnits} >= 0 and ${t.wholePoints} >= 0`,
    ),
    // O5 half-up rounding at 10^8 units per point, as wholePoints() computes it.
    check(
      "reward_snapshot_members_whole_points",
      sql`${t.wholePoints} = (${t.pointUnits} + 50000000) / 100000000`,
    ),
  ],
);

// Single-use, 15-minute handle a member receives in a private chat. Only the token digest is stored.
export const linkSessions = pgTable(
  "link_sessions",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
    telegramUsername: text("telegram_username"),
    tokenDigest: text("token_digest").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, precision: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("link_sessions_community_user").on(t.communityId, t.telegramUserId)],
);

export const walletProofStatus = pgEnum("wallet_proof_status", ["pending", "consumed"]);

// One SDK proof request; the columns mirror the snapshot the SDK verifies against.
export const walletProofRequests = pgTable(
  "wallet_proof_requests",
  {
    requestId: uuid("request_id").primaryKey(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    linkSessionId: uuid("link_session_id")
      .notNull()
      .references(() => linkSessions.id),
    telegramUserId: text("telegram_user_id").notNull(),
    walletAddress: text("wallet_address").notNull(),
    nonceHash: text("nonce_hash").notNull(), // hex SHA-256
    origin: text("origin").notNull(),
    chain: text("chain").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true, precision: 3 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    status: walletProofStatus("status").notNull().default("pending"),
    consumedAt: timestamp("consumed_at", { withTimezone: true, precision: 3 }),
  },
  (t) => [
    check("wallet_proof_lifetime", sql`${t.expiresAt} = ${t.issuedAt} + interval '5 minutes'`),
    index("wallet_proof_requests_session").on(t.linkSessionId),
  ],
);

// Append-only wallet history. members.wallet is the current value; a payout reads the link valid
// at the epoch's closesAt (D3), so a relink never retargets a closed epoch.
export const memberWalletLinks = pgTable(
  "member_wallet_links",
  {
    id: id(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    wallet: text("wallet").notNull(),
    method: linkMethod("method").notNull(),
    proofRequestId: uuid("proof_request_id").references(() => walletProofRequests.requestId),
    validFrom: timestamp("valid_from", { withTimezone: true, precision: 3 }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true, precision: 3 }),
  },
  (t) => [
    uniqueIndex("member_wallet_links_one_current").on(t.memberId).where(sql`${t.validTo} is null`),
    index("member_wallet_links_member_from").on(t.memberId, t.validFrom),
    check(
      "member_wallet_links_signature_has_proof",
      sql`${t.method} <> 'signature' or ${t.proofRequestId} is not null`,
    ),
    check(
      "member_wallet_links_interval",
      sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`,
    ),
  ],
);
