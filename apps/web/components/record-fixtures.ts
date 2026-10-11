import type { WalletRecordEpochV1, WalletRecordV1 } from "@hyphae/core";
import { CLAIM_TX, SIGNED } from "./fixtures.js";

// A wallet's record shaped like the read API's output; wallet.test.tsx checks it against the
// strict schema.

const ts = (day: number, hour = 0) =>
  `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000000Z`;
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

const counted = (n: number, quality: number, points: string) => ({
  id: id(n),
  kind: "reply" as const,
  accepted_at: ts(3, n),
  state: "counted" as const,
  credited_quality: quality,
  point_units: (BigInt(points) * 100_000_000n).toString(),
  points,
});

export const openEpoch: WalletRecordEpochV1 = {
  community: { mint: "MintAbc", name: "Hyphae Lab" },
  index: 3,
  opens_at: ts(9),
  closes_at: ts(16),
  status: "open",
  member_id: id(2),
  totals: {
    contributions: 1,
    counted: 0,
    credited: 0,
    average_credited_quality: null,
    point_units: "0",
    points: "0",
  },
  contributions: [
    {
      id: id(30),
      kind: "text",
      accepted_at: ts(10, 8),
      state: "pending",
      credited_quality: null,
      point_units: null,
      points: null,
    },
  ],
  payout: { status: "unavailable", reason: "no_settlement" },
};

export const paidEpoch: WalletRecordEpochV1 = {
  community: { mint: "MintAbc", name: "Hyphae Lab" },
  index: 2,
  opens_at: ts(2),
  closes_at: ts(9),
  status: "closed",
  member_id: id(2),
  totals: {
    contributions: 2,
    counted: 2,
    credited: 1,
    average_credited_quality: 42.5,
    point_units: "25500000000",
    points: "255",
  },
  contributions: [counted(20, 85, "255"), counted(21, 0, "0")],
  payout: {
    status: "allocated",
    network: "solana:mainnet",
    amount_lamports: "121250000",
    payment: { status: "paid", claim_tx: CLAIM_TX },
  },
};

export const claimableEpoch: WalletRecordEpochV1 = {
  community: { mint: "MintXyz", name: "Other DAO" },
  index: 1,
  opens_at: ts(1),
  closes_at: ts(8),
  status: "closed",
  member_id: id(7),
  totals: {
    contributions: 1,
    counted: 1,
    credited: 1,
    average_credited_quality: 70,
    point_units: "7000000000",
    points: "70",
  },
  contributions: [counted(10, 70, "70")],
  payout: {
    status: "allocated",
    network: "solana:mainnet",
    amount_lamports: "50000000",
    payment: { status: "claimable" },
  },
};

const tally = {
  contributions: 4,
  counted: 3,
  credited: 2,
  average_credited_quality: 51.67,
  point_units: "32500000000",
  points: "325",
};

export const record: WalletRecordV1 = {
  wallet: SIGNED,
  as_of: ts(10, 12),
  totals: { communities: 2, epochs: 3, ...tally },
  communities: [
    {
      mint: "MintAbc",
      name: "Hyphae Lab",
      totals: {
        epochs: 2,
        contributions: 3,
        counted: 2,
        credited: 1,
        average_credited_quality: 42.5,
        point_units: "25500000000",
        points: "255",
      },
    },
    {
      mint: "MintXyz",
      name: "Other DAO",
      totals: {
        epochs: 1,
        contributions: 1,
        counted: 1,
        credited: 1,
        average_credited_quality: 70,
        point_units: "7000000000",
        points: "70",
      },
    },
  ],
  total_epochs: 3,
  offset: 0,
  limit: 20,
  epochs: [openEpoch, paidEpoch, claimableEpoch],
};

// One community, nothing settled yet: no word on the page may read as money having moved.
export const unsettledRecord: WalletRecordV1 = {
  ...record,
  totals: { ...openEpoch.totals, communities: 1, epochs: 1 },
  communities: [
    { mint: "MintAbc", name: "Hyphae Lab", totals: { ...openEpoch.totals, epochs: 1 } },
  ],
  total_epochs: 1,
  epochs: [openEpoch],
};
