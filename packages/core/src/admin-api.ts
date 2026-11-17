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
