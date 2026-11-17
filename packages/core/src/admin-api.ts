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
