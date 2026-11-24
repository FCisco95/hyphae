import { z } from "zod";

const pausedAt = z.iso.datetime().nullable();

export const AdminCommunitySchema = z.strictObject({
  state: z.literal("admin"),
  community: z.strictObject({ mint: z.string().regex(/^[A-Za-z0-9]{1,64}$/), name: z.string() }),
  intake: z
    .strictObject({ paused: z.boolean(), paused_at: pausedAt })
    .refine((value) => value.paused === (value.paused_at !== null)),
  as_of: z.iso.datetime(),
});

// The observed value prevents a stale page from overwriting a newer operator action.
export const AdminIntakeUpdateSchema = z.strictObject({
  paused: z.boolean(),
  expected_paused_at: pausedAt,
});

export type AdminCommunity = z.infer<typeof AdminCommunitySchema>;
export type AdminIntakeUpdate = z.infer<typeof AdminIntakeUpdateSchema>;

// The operator page (roadmap item 3, part A): a wallet-signature login for the community's
// on-chain admin and read-only operator views. Nothing here signs, publishes or moves funds.
const operatorMint = z.string().regex(/^[A-Za-z0-9]{1,64}$/);
const operatorWallet = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

export const OperatorStatusSchema = z.strictObject({ state: z.literal("enabled") });

export const OperatorChallengeRequestSchema = z.strictObject({
  mint: operatorMint,
  wallet: operatorWallet,
});

// A Ledger shows a restricted-ASCII off-chain message of at most 1212 bytes in clear.
export const OperatorChallengeSchema = z.strictObject({
  challenge_id: z.uuid(),
  message: z
    .string()
    .max(1212)
    .regex(/^[\x20-\x7e]+$/),
  expires_at: z.iso.datetime(),
});

// The 64-byte ed25519 signature, base58 (what `solana sign-offchain-message` prints).
export const OperatorSessionRequestSchema = z.strictObject({
  challenge_id: z.uuid(),
  signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/),
});

export const OperatorSessionSchema = z.strictObject({
  wallet: operatorWallet,
  mint: operatorMint,
  expires_at: z.iso.datetime(),
  // Present only for a setup session (part B): it may only initialize the community on-chain.
  role: z.literal("setup").optional(),
});

// Returned once, to the server that holds it (the web proxy's httpOnly cookie).
export const OperatorSessionCreatedSchema = z.strictObject({
  ...OperatorSessionSchema.shape,
  token: z.string().regex(/^hop_[A-Za-z0-9_-]{43}$/),
});

export type OperatorStatus = z.infer<typeof OperatorStatusSchema>;
export type OperatorChallengeRequest = z.infer<typeof OperatorChallengeRequestSchema>;
export type OperatorChallenge = z.infer<typeof OperatorChallengeSchema>;
export type OperatorSessionRequest = z.infer<typeof OperatorSessionRequestSchema>;
export type OperatorSession = z.infer<typeof OperatorSessionSchema>;
export type OperatorSessionCreated = z.infer<typeof OperatorSessionCreatedSchema>;

const lamports = z.string().regex(/^(0|[1-9][0-9]{0,30})$/);
const code = z.string().regex(/^[a-z_]{1,64}$/);
const count = z.number().int().nonnegative();

export const OperatorEpochSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  status: z.enum(["open", "closed", "published"]),
  closes_at: z.iso.datetime(),
  published: z.boolean(),
  decision: z.enum(["distribution_planned", "rolled_over", "distributed", "other"]).nullable(),
  gate: z.strictObject({
    status: z.enum(["ready", "blocked", "not_evaluated"]),
    blockers: z.array(code),
    payable: count,
    held: count,
    not_payable: count,
  }),
});

// Why there is or is not a top-up figure. "ok" carries the same pricing as the gate-ready message.
export const OperatorTopUpSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ok"),
    epoch_index: z.number().int().nonnegative(),
    outcome: z.enum(["planned", "rolled_over"]),
    lamports: lamports.nullable(),
  }),
  z.strictObject({
    status: z.enum(["none", "held", "no_policy", "not_bound", "chain_unavailable"]),
  }),
]);

export const OperatorOverviewSchema = z.strictObject({
  community: z.strictObject({
    mint: operatorMint,
    name: z.string(),
    chain_address: operatorWallet,
    network: z.enum(["solana:mainnet", "solana:devnet"]),
  }),
  hold: z.strictObject({ held: z.boolean() }),
  policy: z.strictObject({ present: z.boolean() }),
  epochs: z.array(OperatorEpochSchema).max(12),
  top_up: OperatorTopUpSchema,
  raids: z.strictObject({
    by_state: z.array(z.strictObject({ state: code, count })),
    active: z
      .array(
        z.strictObject({
          id: z.uuid(),
          target_url: z.string().nullable(),
          closes_at: z.iso.datetime(),
        }),
      )
      .max(5),
    deliveries: z.array(z.strictObject({ status: code, count })),
  }),
  jobs: z.discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("available"),
      groups: z.array(
        z.strictObject({ name: z.string().regex(/^[a-z-]{1,64}$/), state: code, count }),
      ),
    }),
    z.strictObject({ status: z.literal("unavailable") }),
  ]),
  as_of: z.iso.datetime(),
});

// Wallets only, sorted by address: no handle, member, points or Telegram id beside them.
export const OperatorPayableSchema = z.strictObject({
  epoch_index: z.number().int().nonnegative(),
  gate_status: z.enum(["ready", "blocked", "not_evaluated"]),
  wallets: z.array(operatorWallet),
});

export type OperatorEpoch = z.infer<typeof OperatorEpochSchema>;
export type OperatorTopUp = z.infer<typeof OperatorTopUpSchema>;
export type OperatorOverview = z.infer<typeof OperatorOverviewSchema>;
export type OperatorPayable = z.infer<typeof OperatorPayableSchema>;

// The operator page's browser publish and init-community (roadmap item 3, part B). The API builds
// the exact transaction the CLI would, the admin's wallet signs it, and only the signature comes
// back: the API never takes transaction bytes from a client, and holds no key.
const signature = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/);
const hex32 = z.string().regex(/^[0-9a-f]{64}$/);
const base64 = z
  .string()
  .max(2048)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);
const network = z.enum(["solana:mainnet", "solana:devnet"]);

export const OperatorBuildStateSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(["publish", "init"]),
  state: z.enum(["awaiting_signature", "submitting", "done", "failed", "expired"]),
  signature: signature.nullable(),
  expires_at: z.iso.datetime(),
});

// 404 disabled when OPERATOR_PUBLISH_ENABLED is off; an older API image answers not_found.
export const OperatorPublishStatusSchema = z.strictObject({
  state: z.literal("enabled"),
  build: OperatorBuildStateSchema.nullable(),
});

// What the wallet is asked to sign: the unsigned wire transaction (its one signature slot
// empty) and its message bytes, both base64. The signature over `message` is what comes back.
const handoff = {
  build: z.strictObject({ id: z.uuid(), expires_at: z.iso.datetime() }),
  transaction: base64,
  message: base64,
};

// Every number the transaction commits to, shown before the wallet opens.
export const OperatorPublishSummarySchema = z.strictObject({
  network,
  program_id: operatorWallet,
  epoch_index: z.number().int().nonnegative(),
  epochs_paid: z.number().int().positive(),
  gross_lamports: lamports,
  fee_lamports: lamports,
  fee_bps: z.number().int().nonnegative(),
  net_lamports: lamports,
  allocated_lamports: lamports,
  cap_remainder_lamports: lamports,
  dust_lamports: lamports,
  payable_wallets: count,
  root: hex32,
  audit_hash: hex32,
  accounts: z.strictObject({
    fee_payer: operatorWallet,
    community: operatorWallet,
    vault: operatorWallet,
    fee_recipient: operatorWallet,
    epoch: operatorWallet,
  }),
  blockhash: operatorWallet,
  last_valid_block_height: lamports,
  // base58(sha256(message)): what the Ledger Solana app shows when it blind-signs.
  message_hash: operatorWallet,
});

export const OperatorPublishRefusalSchema = z.enum([
  "community_unknown",
  "community_held",
  "no_payout_policy",
  "community_not_on_chain",
  "publisher_not_admin",
]);

export const OperatorPublishBuildSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("awaiting_signature"),
    ...handoff,
    summary: OperatorPublishSummarySchema,
  }),
  z.strictObject({ status: z.literal("refused"), reason: OperatorPublishRefusalSchema }),
  z.strictObject({
    status: z.literal("waiting"),
    epoch_index: z.number().int().nonnegative(),
    blockers: z.array(code),
  }),
  z.strictObject({ status: z.literal("nothing_due") }),
  z.strictObject({
    status: z.literal("rolled_over"),
    epoch_index: z.number().int().nonnegative(),
    reason: code,
  }),
  // Already on-chain (a run sent it and did not record it): recorded now, nothing to sign.
  z.strictObject({
    status: z.literal("published"),
    signature,
    epoch_index: z.number().int().nonnegative(),
    recovered: z.literal(true),
  }),
]);

export const OperatorSubmitRequestSchema = z.strictObject({
  build_id: z.uuid(),
  signature,
});

const submitRefusal = z.enum([
  "build_unknown",
  "expired",
  "signature_invalid",
  "plan_changed",
  "send_failed",
]);

export const OperatorPublishSubmitSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("published"),
    signature,
    epoch_index: z.number().int().nonnegative(),
    recovered: z.boolean(),
  }),
  z.strictObject({
    status: z.literal("refused"),
    reason: z.union([submitRefusal, OperatorPublishRefusalSchema]),
  }),
]);

export const OperatorInitRequestSchema = z.strictObject({ fee_recipient: operatorWallet });

export const OperatorInitSummarySchema = z.strictObject({
  network,
  program_id: operatorWallet,
  admin: operatorWallet,
  mint: operatorMint,
  community: operatorWallet,
  vault: operatorWallet,
  fee_recipient: operatorWallet,
  rent_lamports: lamports,
  admin_lamports: lamports,
  blockhash: operatorWallet,
  last_valid_block_height: lamports,
  message_hash: operatorWallet,
});

export const OperatorInitRefusalSchema = z.enum([
  "not_setup",
  "fee_recipient_mismatch",
  "community_exists",
  "fee_recipient_invalid",
  "program_missing",
]);

export const OperatorInitBuildSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("awaiting_signature"),
    ...handoff,
    summary: OperatorInitSummarySchema,
  }),
  z.strictObject({ status: z.literal("refused"), reason: OperatorInitRefusalSchema }),
]);

export const OperatorInitSubmitSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("initialized"),
    signature,
    community: operatorWallet,
    vault: operatorWallet,
  }),
  z.strictObject({
    status: z.literal("refused"),
    reason: z.union([submitRefusal, OperatorInitRefusalSchema]),
  }),
]);

export type OperatorBuildState = z.infer<typeof OperatorBuildStateSchema>;
export type OperatorPublishStatus = z.infer<typeof OperatorPublishStatusSchema>;
export type OperatorPublishSummary = z.infer<typeof OperatorPublishSummarySchema>;
export type OperatorPublishBuild = z.infer<typeof OperatorPublishBuildSchema>;
export type OperatorSubmitRequest = z.infer<typeof OperatorSubmitRequestSchema>;
export type OperatorPublishSubmit = z.infer<typeof OperatorPublishSubmitSchema>;
export type OperatorInitRequest = z.infer<typeof OperatorInitRequestSchema>;
export type OperatorInitSummary = z.infer<typeof OperatorInitSummarySchema>;
export type OperatorInitBuild = z.infer<typeof OperatorInitBuildSchema>;
export type OperatorInitSubmit = z.infer<typeof OperatorInitSubmitSchema>;
