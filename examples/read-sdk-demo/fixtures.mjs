// Synthetic, disposable data. No community registration or chain evidence is created.
export const communities = [
  {
    mint: "DemoA",
    name: "Fern collective",
    description: "Open epoch with counted and pending work.",
  },
  {
    mint: "DemoB",
    name: "Moss workshop",
    description: "Closed, empty epoch with no payable members.",
  },
];
const time = "2026-10-04T09:00:00.000000Z";
const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

export function fixture(url) {
  const parts = url.pathname.split("/");
  const mint = parts[3];
  const info = communities.find((c) => c.mint === mint);
  if (!info) return null;
  const closed = mint === "DemoB";
  const community = {
    mint,
    name: info.name,
    reward_intake: closed ? "paused" : "open",
    current_epoch: 2,
    epochs: [{ index: 2, opens_at: time, closes_at: time, status: closed ? "closed" : "open" }],
    as_of: time,
  };
  if (parts.length === 4) return community;
  const window = { index: 2, opens_at: time, closes_at: time };
  const unavailable = {
    status: "unavailable",
    reason: closed ? "no_payable_members" : "not_closed",
  };
  if (parts.length === 6)
    return {
      community: { mint, name: info.name },
      ...window,
      status: closed ? "closed" : "open",
      closed,
      final: false,
      as_of: time,
      config: {
        id,
        rubric_version: "local-fixture",
        prompt_version: "local-fixture",
        effort_multiplier_bps: 10000,
        slot_limit: 1,
        payload: {},
      },
      counts: {
        contributions: closed ? 0 : 2,
        members: closed ? 0 : 1,
        counted: closed ? 0 : 1,
        pending: closed ? 0 : 1,
        pending_at_close: 0,
        pending_reconciliation: 0,
        excluded: 0,
      },
      totals: { point_units: closed ? "0" : "7500000000", points: closed ? "0" : "75" },
      snapshot: closed
        ? { status: "frozen", closed_at: time, cutoff_assumption: "local fixture" }
        : { status: "not_frozen" },
      allocation: unavailable,
      payment: { status: "unavailable", reason: "no_settlement" },
      settlement: {
        allocation: unavailable,
        payment: { status: "unavailable", reason: "no_settlement" },
      },
    };
  return null;
}
