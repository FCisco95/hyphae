import type { LooseEpochV1 } from "@hyphae/core";
import type { Result } from "./api.js";

// P14's sections of an epoch. An api that predates the `settlement` field has only the first v1
// sections, which are always unavailable.
export const settlementOf = (e: LooseEpochV1) =>
  e.settlement ?? { allocation: e.allocation, payment: e.payment };

// Where a member claims: the newest closed epoch with a recorded publication, searched newest
// first. One the chain cannot confirm right now still counts; its claim page says why. "none"
// only when the search establishes it, "unavailable" when a read fails before it can tell.
export async function claimTarget(
  closedNewestFirst: readonly number[],
  read: (index: number) => Promise<Result<LooseEpochV1>>,
): Promise<{ index: number } | "none" | "unavailable"> {
  for (const index of closedNewestFirst) {
    const epoch = await read(index);
    if (!epoch.ok) return "unavailable";
    const a = settlementOf(epoch.data).allocation;
    if (a.status === "published") return { index };
    // Every earlier epoch is before the first paid epoch too.
    if (a.reason === "before_first_paid_epoch") return "none";
    if (a.reason !== "no_settlement") return { index };
  }
  return "none";
}
