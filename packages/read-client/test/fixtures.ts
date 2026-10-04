export const TIME = "2026-10-04T09:00:00.000000Z";
export const WALLET = "11111111111111111111111111111111";
export const ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const unavailable = { status: "unavailable", reason: "no_settlement" };

export const community = (mint = "CommunityA") => ({
  mint,
  name: mint,
  reward_intake: "paused",
  current_epoch: 2,
  epochs: [],
  as_of: TIME,
});

export const epoch = (mint = "CommunityA") => ({
  community: { mint, name: mint },
  index: 2,
  opens_at: TIME,
  closes_at: TIME,
  status: "open",
  closed: false,
  final: false,
  as_of: TIME,
  config: {
    id: ID,
    rubric_version: "fixture",
    prompt_version: "fixture",
    effort_multiplier_bps: 10000,
    slot_limit: 1,
    payload: {},
  },
  counts: {
    contributions: 0,
    members: 0,
    counted: 0,
    pending: 0,
    pending_at_close: 0,
    pending_reconciliation: 0,
    excluded: 0,
  },
  totals: { point_units: "9007199254740993", points: "90071992.54740993" },
  snapshot: { status: "not_frozen" },
  allocation: unavailable,
  payment: unavailable,
});

export const contributions = (mint = "CommunityA", offset = 0, limit = 50) => ({
  community: { mint },
  epoch: { index: 2, closed: false, final: false },
  as_of: TIME,
  total_contributions: 0,
  offset,
  limit,
  contributions: [],
});

export const leaderboard = (mint = "CommunityA", offset = 0, limit = 50) => ({
  community: { mint },
  epoch: { index: 2, opens_at: TIME, closes_at: TIME },
  closed: false,
  final: false,
  as_of: TIME,
  total_entries: 0,
  total_contributions: 0,
  offset,
  limit,
  entries: [],
});

export const contribution = () => ({
  id: ID,
  epoch: { index: 2, closes_at: TIME, closed: false, final: false },
  member_id: ID,
  wallet: null,
  wallet_status: "none",
  kind: "text",
  url: null,
  raid_id: null,
  accepted_at: TIME,
  state: "pending",
  selected: null,
  community: { mint: "CommunityA" },
  text: "Local fixture",
  capture: { source: "telegram_text", captured_at: TIME, limitations: [] },
  reentry_of: null,
  reentered_as: null,
  nomination: null,
  revisions: [],
});

export const leaf = () => ({
  community: { mint: "CommunityA" },
  epoch: { index: 2 },
  network: "solana:devnet",
  program_id: WALLET,
  community_address: WALLET,
  vault_address: WALLET,
  epoch_address: WALLET,
  receipt_address: WALLET,
  score: "9007199254740993",
  amount_lamports: "9007199254740993",
  evidence_hash: "0".repeat(64),
  proof: [],
  root: "0".repeat(64),
});

export const claim = () => ({ ...leaf(), wallet: WALLET, payment: unavailable, as_of: TIME });
export const walletClaims = (offset = 0, limit = 50) => ({
  wallet: WALLET,
  as_of: TIME,
  total_claims: 1,
  offset,
  limit,
  claims: [{ ...leaf(), payment: unavailable }],
});

export function responseFor(url: string | URL | Request) {
  const u = new URL(String(url));
  const mint = u.pathname.split("/communities/")[1]?.split("/")[0] ?? "CommunityA";
  const offset = Number(u.searchParams.get("offset") ?? 0);
  const limit = Number(u.searchParams.get("limit") ?? 50);
  if (u.pathname.includes("/claims/")) return claim();
  if (u.pathname.startsWith("/v1/wallets/")) return walletClaims(offset, limit);
  if (u.pathname.startsWith("/v1/contributions/")) return contribution();
  if (u.pathname.endsWith("/contributions")) return contributions(mint, offset, limit);
  if (u.pathname.endsWith("/leaderboard")) return leaderboard(mint, offset, limit);
  if (u.pathname.includes("/epochs/")) return epoch(mint);
  return community(mint);
}
