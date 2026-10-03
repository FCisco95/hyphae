import { canonicalJson, promptTemplateHash, sha256Hex } from "@hyphae/core";
import { isAddress } from "@solana/kit";
import { z } from "zod";
import { configDigest, parseActivationTime, RewardConfigPayload } from "../rewards/config.js";

export type SetupCode =
  | "invalid_manifest"
  | "invalid_arguments"
  | "plan_mismatch"
  | "environment_mismatch"
  | "credentials_missing"
  | "telegram_unavailable"
  | "telegram_bot_mismatch"
  | "telegram_chat_mismatch"
  | "telegram_bot_not_admin"
  | "telegram_admin_unverified"
  | "registration_conflict"
  | "activation_not_future"
  | "setup_outcome_unknown"
  | "setup_unavailable";

export class SetupError extends Error {
  constructor(readonly code: SetupCode) {
    super(code);
  }
}

const positiveId = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((v) => BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER));
const groupId = z
  .string()
  .regex(/^-[1-9]\d*$/)
  .refine((v) => BigInt(v) >= BigInt(-Number.MAX_SAFE_INTEGER));
const Schema = z
  .object({
    version: z.literal(1),
    environment: z.enum(["disposable", "production"]),
    database: z
      .object({
        host: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[a-z0-9.-]+$/),
        port: z.number().int().min(1).max(65535),
        name: z
          .string()
          .min(1)
          .max(63)
          .regex(/^[A-Za-z0-9_-]+$/),
      })
      .strict(),
    communityId: z.uuid().refine((v) => v === v.toLowerCase()),
    mint: z.string().refine(isAddress),
    name: z
      .string()
      .min(1)
      .max(120)
      .refine(
        (v) =>
          v === v.trim() &&
          Array.from(v).every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127),
      ),
    telegramChatId: groupId,
    adminTelegramUserId: positiveId,
    botUserId: positiveId,
    approvalReference: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9._:/-]+$/),
    activationTime: z.string(),
    rewardConfig: RewardConfigPayload,
  })
  .strict();

export type SetupManifest = z.infer<typeof Schema>;

// A private operator manifest is not an ownership credential. The operator must separately
// establish mint/community authority; this parser is never a public provisioning endpoint.
export function parseSetupManifest(value: unknown): SetupManifest {
  try {
    const parsed = Schema.parse(value);
    // Nested existing schemas strip unknown fields. Refuse rather than approving a different
    // configuration from the one the operator supplied.
    if (canonicalJson(value) !== canonicalJson(parsed)) throw new Error();
    const at = parseActivationTime(parsed.activationTime);
    if (at.getTime() % 1000 !== 0) throw new Error();
    const { rubric, scoring } = parsed.rewardConfig;
    if (rubric.community !== parsed.name || parsed.botUserId === parsed.adminTelegramUserId)
      throw new Error();
    if (Math.abs(rubric.criteria.reduce((n, c) => n + c.weight, 0) - 1) > 1e-9) throw new Error();
    if (new Set(rubric.criteria.map((c) => c.key)).size !== rubric.criteria.length)
      throw new Error();
    if (promptTemplateHash(scoring.promptVersion) !== scoring.promptTemplateHash) throw new Error();
    return parsed;
  } catch {
    throw new SetupError("invalid_manifest");
  }
}

export function setupPlan(input: SetupManifest) {
  const m = parseSetupManifest(input);
  return {
    hash: sha256Hex(canonicalJson(m)),
    configDigest: configDigest(m.rewardConfig),
    communityId: m.communityId,
    mint: m.mint,
    name: m.name,
    environment: m.environment,
    database: m.database,
    telegramChatId: m.telegramChatId,
    adminTelegramUserId: m.adminTelegramUserId,
    botUserId: m.botUserId,
    activationTime: new Date(m.activationTime).toISOString(),
    effects: ["register one community", "pin its first future epoch", "leave reward intake paused"],
    paymentsEnabled: false,
    authority: "operator-attested; Telegram admin status does not prove Organic mint ownership",
  };
}
