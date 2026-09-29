// The pilot's custody policy, word for word as Cisco approved it on 2026-09-27 (decision 2,
// docs/handoffs/2026-09-27-custody-wording-and-ledger-rulings.md). The bot's /rules, the audit
// site and the README show it; a test holds the README to this text.
export const CUSTODY_SUMMARY =
  "Pilot policy. Hyphae's publisher key sets each epoch's payout list, so you trust it with that epoch's pot. We keep that key on a hardware wallet and fund one epoch at a time, just before it pays.";

export const CUSTODY_POLICY = `${CUSTODY_SUMMARY} The program has no withdraw instruction: SOL leaves the vault only through member claims and the 3% fee. The program can still be upgraded. The upgrade key is held the same way, and any upgrade is announced here before it is used.`;

export const CUSTODY_POLICY_URL =
  "https://github.com/FCisco95/hyphae-program#custody-during-the-pilot";
