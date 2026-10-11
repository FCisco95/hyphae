import type { PayoutStep } from "../../payout/readiness.js";
import { startPayload } from "./link.js";
import { rulesStartPayload } from "./rules.js";

// The button for a member's next payout step. Both open the member's private chat with the bot,
// which checks membership before anything else.
export function stepButton(
  step: PayoutStep,
  botUsername: string,
  communityId: string,
): { label: string; url: string } {
  return step === "wallet"
    ? {
        label: "Link my wallet",
        url: `https://t.me/${botUsername}?start=${startPayload(communityId)}`,
      }
    : {
        label: "Take the rules test",
        url: `https://t.me/${botUsername}?start=${rulesStartPayload(communityId)}`,
      };
}
