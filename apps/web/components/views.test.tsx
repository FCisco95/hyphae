import { ReadApiV1, ReadApiV1Loose } from "@hyphae/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as f from "./fixtures.js";
import {
  CommunityView,
  ContributionView,
  EpochView,
  LeaderboardView,
  UnavailableView,
} from "./views.js";

const text = (el: React.ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
// Nothing on the audit page may read as money having moved.
const NEVER = /\bpaid\b|\bclaimed\b|payout sent/i;

describe("fixtures", () => {
  it("match the strict API schemas", () => {
    ReadApiV1.community.parse(f.community);
    for (const e of [
      f.finalEpoch,
      f.openEpoch,
      f.closingEpoch,
      f.settledEpoch,
      f.retainedEpoch,
      f.chainDownEpoch,
    ]) {
      ReadApiV1.epoch.parse(e);
    }
    ReadApiV1.contributions.parse(f.contributions);
    ReadApiV1.leaderboard.parse(f.leaderboard);
    ReadApiV1.contribution.parse(f.offTopic);
    ReadApiV1.contribution.parse(f.pendingAtClose);
    ReadApiV1.claim.parse(f.claim);
    ReadApiV1Loose.epoch.parse(f.firstV1Epoch);
  });
});

describe("CommunityView", () => {
  it("lists epochs with their window and status", () => {
    const t = text(<CommunityView community={f.community} />);
    expect(t).toContain("Hyphae Lab");
    expect(t).toContain("Epoch 2");
    expect(t).toContain("2026-10-02 00:00 UTC");
    expect(t).toMatch(/open/i);
  });

  it("says when there is no epoch yet", () => {
    const t = text(
      <CommunityView community={{ ...f.community, current_epoch: null, epochs: [] }} />,
    );
    expect(t).toContain("No reward epoch yet.");
  });
});

describe("EpochView", () => {
  it("a final epoch explains each row and never shows allocation as paid", () => {
    const t = text(<EpochView epoch={f.finalEpoch} list={f.contributions} />);
    expect(t).toContain("Raw 84, credited 0: off-topic is a hard zero.");
    expect(t).toContain("Not allocated. No payout exists for this epoch.");
    expect(t).toContain("Final");
    expect(t).toContain("255");
    expect(t).toContain("unverified");
    expect(t).toContain("Not scored before the epoch closed");
    expect(t).not.toMatch(NEVER);
  });

  it("marks an open epoch provisional and a closing one as awaiting its snapshot", () => {
    const open = text(
      <EpochView epoch={f.openEpoch} list={{ ...f.contributions, contributions: [] }} />,
    );
    expect(open).toContain("Provisional: this epoch is still open.");
    expect(open).toContain("No contributions in this epoch yet.");
    const closing = text(<EpochView epoch={f.closingEpoch} list={f.contributions} />);
    expect(closing).toContain("Final numbers appear when the snapshot is written");
  });

  it("renders a verified wallet shortened and never an unverified address", () => {
    const html = renderToStaticMarkup(<EpochView epoch={f.finalEpoch} list={f.contributions} />);
    expect(html).toContain("MAoR…VhAB");
  });
});

describe("Settlement (P14)", () => {
  const settlement = (e: typeof f.firstV1Epoch) =>
    text(<EpochView epoch={e} list={f.contributions} />)
      .split("Settlement")[1]
      ?.split("Contributions")[0] ?? "";

  it("shows every published number exactly, with the publish transaction", () => {
    const html = renderToStaticMarkup(<EpochView epoch={f.settledEpoch} list={f.contributions} />);
    const t = settlement(f.settledEpoch);
    for (const expected of [
      "0.5 SOL",
      "0.015 SOL",
      "3%",
      "0.485 SOL",
      "0.304603658 SOL",
      "0.180396341 SOL",
      "0.000000001 SOL",
      "0.12125 SOL",
      "0.183353658 SOL",
      "devnet",
    ]) {
      expect(t).toContain(expected);
    }
    expect(html).toContain(`https://explorer.solana.com/tx/${f.PUBLISH_TX}?cluster=devnet`);
  });

  it("shows paid only next to the claim transaction, and a way to claim the rest", () => {
    const html = renderToStaticMarkup(<EpochView epoch={f.settledEpoch} list={f.contributions} />);
    expect(html).toContain(`https://explorer.solana.com/tx/${f.CLAIM_TX}?cluster=devnet`);
    expect(settlement(f.settledEpoch).match(/\bPaid\b/g)).toHaveLength(1);
    expect(settlement(f.settledEpoch)).toContain("Claimable");
    expect(html).toContain('href="/c/MintAbc/e/2/claim"');
  });

  it("an epoch before the first paid epoch is retained", () => {
    const t = settlement(f.retainedEpoch);
    expect(t).toContain("Retained: this epoch is before the first paid epoch.");
    // P14's own wording names the first paid epoch; no payment is shown.
    expect(t).not.toMatch(/Paid in|claimed|SOL/i);
  });

  it("an api that predates the settlement field shows its first v1 sections", () => {
    expect(settlement(f.firstV1Epoch)).toContain("Not allocated. No payout exists for this epoch.");
  });

  it("an unreadable chain shows no number at all, and never paid", () => {
    const t = settlement(f.chainDownEpoch);
    expect(t).toContain("can't be confirmed on-chain right now");
    expect(t).not.toMatch(/\d/);
    expect(t).not.toMatch(NEVER);
  });
});

describe("LeaderboardView", () => {
  it("shows exact and whole points, provisional while open", () => {
    const t = text(<LeaderboardView board={f.leaderboard} />);
    expect(t).toContain("Provisional: this epoch is still open.");
    expect(t).toContain("127.5");
    expect(t).toContain("128");
    expect(t).toContain("unverified");
    expect(t).not.toMatch(NEVER);
  });
});

describe("ContributionView", () => {
  it("tells the audit row as a sentence and lists every revision with its provenance", () => {
    const t = text(<ContributionView c={f.offTopic} />);
    expect(t).toContain("Raw 84, credited 0: off-topic is a hard zero.");
    expect(t).toContain("Look at this other coin instead.");
    expect(t).toContain("media_not_captured");
    expect(t).toContain("Revision 1");
    expect(t).toContain("Revision 2");
    expect(t).toMatch(/late/i);
    expect(t).toContain("admin:cisco");
    expect(t).toContain("claude-sonnet-5");
    expect(t).toContain("aaaaaaaaaaaa");
    expect(t).not.toMatch(NEVER);
  });

  it("says what a contribution that never counted earns", () => {
    const t = text(<ContributionView c={f.pendingAtClose} />);
    expect(t).toContain("Not scored before the epoch closed; it earns nothing in this epoch.");
  });
});

describe("freshness", () => {
  it("every page with a read time says when its data was read, so a stale cache shows its age", () => {
    const asOf = "Data as of 2026-10-03 00:00 UTC.";
    expect(text(<CommunityView community={f.community} />)).toContain(asOf);
    expect(text(<EpochView epoch={f.finalEpoch} list={f.contributions} />)).toContain(asOf);
    expect(text(<LeaderboardView board={f.leaderboard} />)).toContain(asOf);
  });
});

describe("UnavailableView", () => {
  it("never renders a number", () => {
    const t = text(<UnavailableView />);
    expect(t).toContain("The audit API is unavailable right now. Nothing on this page is a zero.");
    expect(t).not.toMatch(/\d/);
  });
});
