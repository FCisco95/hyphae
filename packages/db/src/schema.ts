import { bigint, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
  createdAt: createdAt(),
});

export const linkMethod = pgEnum("link_method", ["paste", "signature"]);

export const members = pgTable(
  "members",
  {
    id: id(),
    communityId: uuid("community_id").notNull().references(() => communities.id),
    telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
    telegramUsername: text("telegram_username"),
    wallet: text("wallet").notNull(),
    xHandle: text("x_handle"),
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
  communityId: uuid("community_id").notNull().references(() => communities.id),
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
    communityId: uuid("community_id").notNull().references(() => communities.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
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
  contributionId: uuid("contribution_id").notNull().references(() => contributions.id),
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
    communityId: uuid("community_id").notNull().references(() => communities.id),
    index: integer("index").notNull(),
    status: epochStatus("status").notNull().default("open"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    root: text("root"),
    potLamports: bigint("pot_lamports", { mode: "bigint" }),
    rubricHash: text("rubric_hash"),
    publishTx: text("publish_tx"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("epochs_community_index").on(t.communityId, t.index)],
);

export const leaves = pgTable(
  "leaves",
  {
    id: id(),
    epochId: uuid("epoch_id").notNull().references(() => epochs.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    wallet: text("wallet").notNull(),
    score: bigint("score", { mode: "bigint" }).notNull(),
    amountLamports: bigint("amount_lamports", { mode: "bigint" }).notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    proof: jsonb("proof").notNull(), // hex[] sibling hashes
    claimTx: text("claim_tx"),
  },
  (t) => [uniqueIndex("leaves_epoch_wallet").on(t.epochId, t.wallet)],
);
