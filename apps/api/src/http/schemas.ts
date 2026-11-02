import { ReadApiV1 } from "@hyphae/core";
import { z } from "zod";

// Fields this api added inside v1 on top of the shared response schemas (A4: fields are only
// added). The api checks its own answers with these; a consumer that parses loosely accepts an
// older answer without them.

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const uint = z.string().regex(/^(0|[1-9]\d*)$/);

// Who can be paid for the epoch, as typed fields (contract 2026-10-30 §6). The hold is a balance
// of the community's mint read in the window after the close, never a snapshot at a past instant.
export const EligibilitySchema = z.strictObject({
  // The pinned rubric's minimum balance in base units; "0" when it sets no hold condition.
  min_hold_units: uint,
  // From the chain; null when it could not be read in time.
  mint_decimals: z.number().int().min(0).max(18).nullable(),
  hold_checked_from: iso,
  hold_checked_until: iso,
});

export const EpochSchema = ReadApiV1.epoch.extend({ eligibility: EligibilitySchema });
// `epoch=all`: every served epoch of the community summed per member (contract §5).
export const AllTimeLeaderboardSchema = ReadApiV1.leaderboard.extend({ epoch: z.null() });

export type Eligibility = z.infer<typeof EligibilitySchema>;
export type EpochApi = z.infer<typeof EpochSchema>;
export type AllTimeLeaderboard = z.infer<typeof AllTimeLeaderboardSchema>;

// A3's microsecond timestamp plus `ms` milliseconds, keeping the microseconds.
export function addMsUs(isoUs: string, ms: number): string {
  const micro = isoUs.slice(23, 26);
  const shifted = new Date(Date.parse(`${isoUs.slice(0, 23)}Z`) + ms).toISOString();
  return `${shifted.slice(0, 23)}${micro}Z`;
}
