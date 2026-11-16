// Communities whose payouts are held by a recorded decision. The record is this file, so it
// travels with git to every machine and lifting a hold is a reviewed commit, never a setting.
// The operator's publish command and the gate-ready message both stop at a held community.
export const MYCEL_MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";

export interface CommunityHold {
  mint: string;
  reason: string;
}

const HOLDS: readonly CommunityHold[] = [
  {
    mint: MYCEL_MINT,
    reason:
      "MYCEL payouts are held until Cisco lifts the hold (docs/HANDOFF.md); lifting it is a commit that removes this entry",
  },
];

export function communityHold(mint: string): CommunityHold | null {
  return HOLDS.find((h) => h.mint === mint) ?? null;
}
