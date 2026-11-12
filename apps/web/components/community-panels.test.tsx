import { ReadApiV1 } from "@hyphae/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommunityBoard } from "./board.js";
import { CommunityOverview } from "./community.js";
import { community, communityStats, leaderboard, PROGRAM, PUBLISH_TX, SIGNED } from "./fixtures.js";
import { Countdown, EpochClock } from "./live.js";
import { StatsStrip } from "./stats-strip.js";
import { TreasuryPanel } from "./treasury.js";
import { CommunityView } from "./views.js";

vi.mock("./raid-refresh.js", () => ({ RaidRefresh: () => null }));

const VAULT = "9VLtVau1tAddre55xxxxxxxxxxxxxxxxxxxxxxxxV";
const vault = {
  status: "available" as const,
  network: "solana:mainnet" as const,
  program_id: PROGRAM,
  community_address: "HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX",
  vault_address: VAULT,
  admin: "2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR",
  fee_recipient: "rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK",
  balance_lamports: "1500000000",
  outstanding_lamports: "285000000",
  rent_lamports: "890880",
  unassigned_lamports: "1214109120",
};
const text = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
const unavailable = {
  ...communityStats,
  payouts: { status: "unavailable" as const, reason: "chain_unavailable" },
};
const board = (over = {}) => ({ ok: true as const, data: { ...leaderboard, ...over } });

describe("the fixture", () => {
  it("is what the api serves", () => {
    ReadApiV1.communityStats.parse(communityStats);
    ReadApiV1.communityStats.parse(unavailable);
  });
});

describe("StatsStrip", () => {
  it("shows what was paid, what waits, how many epochs and members, with a way to fund", () => {
    const t = text(<StatsStrip stats={communityStats} vault={vault} />);
    expect(t).toContain("Paid to members 0.2 SOL");
    expect(t).toContain("Waiting to be claimed 0.285 SOL");
    expect(t).toContain("Epochs paid 1 of 2");
    expect(t).toContain("Members who earned points 9");
    expect(t).toContain("Registered members 12");
    const html = renderToStaticMarkup(<StatsStrip stats={communityStats} vault={vault} />);
    expect(html).toContain('href="#treasury"');
    expect(html).toContain("Fund this community");
  });

  it("says Solana could not be read instead of showing a zero, and still shows the counts", () => {
    const t = text(
      <StatsStrip stats={unavailable} vault={{ status: "unavailable", reason: "x" }} />,
    );
    expect(t).toContain("Paid to members Not confirmed");
    expect(t).toContain("Epochs paid Not confirmed");
    expect(t).not.toContain("0 SOL");
    expect(t).toContain("Registered members 12");
    expect(t).toContain("See the treasury");
    expect(t).not.toContain("Fund this community");
  });
});

describe("TreasuryPanel", () => {
  it("links the program, the vault, every publish transaction and root to the explorer", () => {
    const html = renderToStaticMarkup(<TreasuryPanel vault={vault} stats={communityStats} />);
    expect(html).toContain(`href="https://explorer.solana.com/address/${PROGRAM}"`);
    expect(html).toContain(`href="https://explorer.solana.com/address/${VAULT}"`);
    expect(html).toContain(`href="https://explorer.solana.com/tx/${PUBLISH_TX}"`);
    const publication =
      communityStats.payouts.status === "available" && communityStats.payouts.publications[0];
    if (!publication) throw new Error("fixture");
    expect(html).toContain(
      `href="https://explorer.solana.com/address/${publication.epoch_address}"`,
    );
    expect(html).toContain(publication.root);
    expect(html).toContain(`/c/MintAbc/e/1`);
    const t = text(<TreasuryPanel vault={vault} stats={communityStats} />);
    expect(t).toContain("Fees 0.015 SOL");
    expect(t).toContain("Claimed 0.2 SOL");
    expect(t).toContain("Free for the next epoch 1.21410912 SOL");
    expect(t).toContain("0.2 SOL of 0.485 SOL");
  });

  it("uses the devnet explorer for a devnet community", () => {
    const stats = {
      ...communityStats,
      payouts: { ...communityStats.payouts, network: "solana:devnet" as const },
    };
    const html = renderToStaticMarkup(
      <TreasuryPanel vault={{ ...vault, network: "solana:devnet" }} stats={stats} />,
    );
    expect(html).toContain(`/tx/${PUBLISH_TX}?cluster=devnet`);
    expect(html).toContain(`${PROGRAM}?cluster=devnet`);
  });

  it("says payout totals cannot be confirmed, never zero, and keeps the vault to fund", () => {
    const t = text(<TreasuryPanel vault={vault} stats={unavailable} />);
    expect(t).toContain("Payout totals cannot be confirmed on Solana right now");
    expect(t).toContain("Fund this community");
    expect(t).not.toContain("Claimed 0 SOL");
  });

  it("says nothing is published yet when it is true", () => {
    const stats = {
      ...communityStats,
      payouts: {
        ...communityStats.payouts,
        network: null,
        epochs_paid: 0,
        gross_lamports: "0",
        fee_lamports: "0",
        allocated_lamports: "0",
        claimed_lamports: "0",
        unclaimed_lamports: "0",
        publications: [],
      },
    };
    const t = text(<TreasuryPanel vault={vault} stats={stats} />);
    expect(t).toContain("No epoch has been published yet");
  });
});

describe("CommunityBoard", () => {
  const base = "/c/MintAbc";
  it("toggles between the epoch and all time with plain links, marking the one shown", () => {
    const epoch = renderToStaticMarkup(
      <CommunityBoard base={base} scope="epoch" epochIndex={2} board={board()} />,
    );
    expect(epoch).toContain('href="/c/MintAbc?board=epoch#leaderboard" aria-current="true"');
    expect(epoch).toContain('href="/c/MintAbc?board=all#leaderboard"');
    expect(epoch).toContain("The full epoch table");
    expect(epoch).toContain("/c/MintAbc/e/2/leaderboard");
    const all = renderToStaticMarkup(
      <CommunityBoard base={base} scope="all" epochIndex={2} board={board({ epoch: null })} />,
    );
    expect(all).toContain('href="/c/MintAbc?board=all#leaderboard" aria-current="true"');
    expect(all).toContain("Every epoch added together");
    expect(all).not.toContain("The full epoch table");
  });

  it("offers only all time when there is no epoch to show", () => {
    const html = renderToStaticMarkup(
      <CommunityBoard base={base} scope="all" epochIndex={null} board={board({ entries: [] })} />,
    );
    expect(html).not.toContain("board=epoch");
    expect(html).toContain("Nobody has points here yet");
  });

  it("shows a wallet only when it was signed, and no handle or private id", () => {
    const html = renderToStaticMarkup(
      <CommunityBoard base={base} scope="epoch" epochIndex={2} board={board()} />,
    );
    expect(html).toContain(`/wallet/${SIGNED}`);
    expect(html).toContain("unverified");
    expect(html).not.toMatch(/telegram|@\w|x\.com/i);
  });

  it("says it cannot read the board instead of showing an empty one", () => {
    const html = text(
      <CommunityBoard
        base={base}
        scope="all"
        epochIndex={2}
        board={{ ok: false, reason: "unavailable" }}
      />,
    );
    expect(html).toContain("cannot be read right now");
    expect(html).not.toContain("Nobody has points");
  });
});

describe("the live clock", () => {
  const asOf = "2026-10-03T00:00:00.000000Z";
  const open = community.epochs[0];
  if (!open) throw new Error("fixture");

  it("renders from the read's own time, so the server and the browser agree on the first paint", () => {
    const html = renderToStaticMarkup(
      <EpochClock epoch={open} payouts={communityStats.payouts} asOf={asOf} />,
    );
    expect(html).toContain("Epoch 2: earning");
    expect(html).toContain('<time dateTime="2026-10-09T00:00:00.000Z">2026-10-09 00:00 UTC</time>');
    expect(html).toContain('aria-current="step"');
    expect(html.match(/data-state="done"/g)).toBeNull();
    expect(html.match(/data-state="next"/g)).toHaveLength(3);
  });

  it("puts a later phase in view when the read says the epoch has closed", () => {
    const html = text(
      <EpochClock
        epoch={{ ...open, status: "closed" }}
        payouts={communityStats.payouts}
        asOf="2026-10-20T00:00:00.000000Z"
      />,
    );
    expect(html).toContain("Epoch 2: publishing");
  });

  it("counts down to a raid's end", () => {
    const html = renderToStaticMarkup(
      <Countdown to="2026-10-03T12:00:00.000000Z" asOf={asOf} label="Next raid ends" />,
    );
    expect(html).toContain("Next raid ends");
    expect(html).toContain("2026-10-03 12:00 UTC");
  });
});

describe("the community page", () => {
  const feed = {
    ok: true as const,
    data: {
      community: { mint: community.mint },
      reward_intake: "open" as const,
      as_of: community.as_of,
      raids: [],
    },
  };
  const panels = {
    stats: communityStats,
    board: { scope: "epoch" as const, epochIndex: 2, result: board() },
  };
  const withVault = { ...community, vault };

  it("shows the stats strip, clock, board and treasury when the stats read worked, fund only once", () => {
    const t = text(<CommunityView community={withVault} raids={feed} panels={panels} />);
    expect(t).toContain("At a glance");
    expect(t).toContain("Epoch clock");
    expect(t).toContain("Leaderboard");
    expect(t).toContain("The community's money, from Solana.");
    expect(t).toContain("Project info");
    expect(t.match(/Fund this community/g)?.length).toBe(2); // the button and the panel title
    expect(t.match(/Anyone can fund the vault/g)?.length).toBe(1);
  });

  it("is today's page, with no new panel and no error, when there is no stats read", () => {
    const html = renderToStaticMarkup(<CommunityView community={withVault} raids={feed} />);
    const t = text(<CommunityView community={withVault} raids={feed} />);
    for (const absent of [
      "At a glance",
      "Epoch clock",
      "Leaderboard",
      "Treasury",
      "Project info",
    ]) {
      expect(t).not.toContain(absent);
    }
    expect(html).not.toContain('id="treasury"');
    // The vault is where it was: inside the epoch history.
    expect(t).toContain("Epoch history");
    expect(t.match(/Fund this community/g)?.length).toBe(1);
    expect(t.indexOf("Epoch history")).toBeLessThan(t.indexOf("Fund this community"));
  });

  it("puts the new panels above the epoch history", () => {
    const t = text(<CommunityOverview community={withVault} raids={feed} panels={panels} />);
    expect(t.indexOf("At a glance")).toBeLessThan(t.indexOf("Find a post, read the brief"));
    expect(t.indexOf("Find a post, read the brief")).toBeLessThan(t.indexOf("Leaderboard"));
  });

  it("never shows an X handle next to a wallet", () => {
    const t = text(<CommunityView community={withVault} raids={feed} panels={panels} />);
    expect(t).not.toMatch(/@\w/);
  });
});
