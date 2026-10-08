import { CUSTODY_POLICY_URL, CUSTODY_SUMMARY, ReadApiV1, ReadApiV1Loose } from "@hyphae/core";
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
      f.amendedEpoch,
    ]) {
      ReadApiV1.epoch.parse(e);
    }
    ReadApiV1.contributions.parse(f.contributions);
    ReadApiV1.contributions.parse(f.openContributions);
    ReadApiV1.leaderboard.parse(f.leaderboard);
    ReadApiV1.contribution.parse(f.offTopic);
    ReadApiV1.contribution.parse(f.pendingAtClose);
    ReadApiV1.contribution.parse(f.amendedContribution);
    ReadApiV1.claim.parse(f.claim);
    ReadApiV1Loose.epoch.parse(f.firstV1Epoch);
  });
});

describe("CommunityView", () => {
  it("lists epochs with their window and status", () => {
    const t = text(<CommunityView community={f.community} />);
    expect(t).toContain("Hyphae Lab");
    expect(t).toContain("Fund this community");
    expect(t).toContain("not on Solana yet");
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

  it("says, for each scored row, whether its member can be paid, and never just Counted", () => {
    const open = text(<EpochView epoch={f.openEpoch} list={f.openContributions} />);
    expect(open).toContain(
      "Scored. Wallet and rules test done. The hold is checked after the close.",
    );
    expect(open).toContain("Scored. Not payable yet: link a wallet by signing.");
    expect(open).toContain("Scored. Not payable yet: pass the rules test.");
    expect(open).toContain(
      "Scored. Not payable yet: link a wallet by signing and pass the rules test.",
    );
    expect(open).toContain("Not scored yet.");
    expect(open).not.toContain("Counted.");
    expect(open).not.toMatch(NEVER);
    expect(open).not.toMatch(/payable:|confirmed/i);
    const final = text(<EpochView epoch={f.finalEpoch} list={f.contributions} />);
    expect(final).toContain("Scored. Payable: wallet, rules test and hold confirmed.");
  });

  it("renders a verified wallet shortened and never an unverified address", () => {
    const html = renderToStaticMarkup(<EpochView epoch={f.finalEpoch} list={f.contributions} />);
    expect(html).toContain("MAoR…VhAB");
  });
});

describe("a pilot amendment", () => {
  it("the epoch says when it took effect, which prompts, why, and what did not change", () => {
    const t = text(<EpochView epoch={f.amendedEpoch} list={f.contributions} />);
    expect(t).toContain("Pilot amendment");
    expect(t).toContain(
      "From 2026-10-07 18:00 UTC, contributions admitted in this epoch are scored with reward-eval/2 instead of reward-eval/1.",
    );
    expect(t).toContain(
      "Pilot testing phase: scoring is less strict while members learn the rules.",
    );
    expect(t).toContain(
      "Recorded by Cisco (founder) on 2026-10-07 16:30 UTC, before it took effect.",
    );
    expect(t).toContain(
      "Contributions admitted earlier keep the prompt and scores they had. The rubric, flags, hard zeros, AI caps, the 60-point floor and the payout rules did not change.",
    );
  });

  it("an epoch without one shows nothing about it", () => {
    expect(text(<EpochView epoch={f.openEpoch} list={f.contributions} />)).not.toContain(
      "Pilot amendment",
    );
    expect(text(<EpochView epoch={f.firstV1Epoch} list={f.contributions} />)).not.toContain(
      "Pilot amendment",
    );
  });

  it("a contribution admitted under it says so, scored or not", () => {
    expect(text(<ContributionView c={f.amendedContribution} />)).toContain(
      "Admitted under this epoch's pilot amendment, so reward-eval/2 scores it (in effect from 2026-10-07 18:00 UTC).",
    );
    expect(text(<ContributionView c={f.pendingAtClose} />)).not.toContain("pilot amendment");
  });

  it("shows an effective time that is not a whole minute to the microsecond", () => {
    const at = "2026-10-07T18:00:30.000000Z";
    const [a] = f.amendedEpoch.amendments ?? [];
    if (!a) throw new Error("fixture");
    const t = text(
      <EpochView
        epoch={{ ...f.amendedEpoch, amendments: [{ ...a, effective_at: at }] }}
        list={f.contributions}
      />,
    );
    expect(t).toContain("From 2026-10-07 18:00:30.000000 UTC,");
    const c = text(
      <ContributionView
        c={{
          ...f.amendedContribution,
          amendment: { effective_at: at, prompt_version: "reward-eval/2" },
        }}
      />,
    );
    expect(c).toContain("(in effect from 2026-10-07 18:00:30.000000 UTC)");
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

  it("states the pilot's custody policy with a link to all of it", () => {
    const html = renderToStaticMarkup(<EpochView epoch={f.settledEpoch} list={f.contributions} />);
    expect(settlement(f.settledEpoch)).toContain(CUSTODY_SUMMARY);
    expect(html).toContain(`href="${CUSTODY_POLICY_URL}"`);
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
    expect(t).toContain("Wallet and rules test done. The hold is checked after the close.");
    expect(t).toContain(
      "Not payable yet: link a wallet by signing, pass the rules test and earn points.",
    );
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

  it("says whether the member behind a scored contribution can be paid", () => {
    expect(text(<ContributionView c={f.offTopic} />)).toContain(
      "Scored. Payable: wallet, rules test and hold confirmed.",
    );
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
  it("never renders a number, and says what to do", () => {
    const t = text(<UnavailableView />);
    expect(t).toContain("The audit data can't be read right now.");
    expect(t).toContain("Nothing is shown rather than a guess. Reload the page in a minute.");
    expect(t).not.toMatch(/\d/);
  });
});

describe("tables on a phone", () => {
  // Below 640px each row stacks, and each cell shows its column's name from data-label.
  it("label every cell with its column and stack on narrow screens", () => {
    const pages = [
      <CommunityView key="c" community={f.community} />,
      <EpochView key="e" epoch={f.settledEpoch} list={f.contributions} />,
      <LeaderboardView key="l" board={f.leaderboard} />,
    ];
    let tables = 0;
    for (const page of pages) {
      const html = renderToStaticMarkup(page);
      for (const table of html.match(/<table[\s\S]*?<\/table>/g) ?? []) {
        tables += 1;
        expect(table).toMatch(/^<table class="stack"/);
        const columns = [...table.matchAll(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g)].map((m) => m[1]);
        for (const row of table.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr[\s\S]*?<\/tr>/g) ??
          []) {
          const labels = [...row.matchAll(/<td[^>]*data-label="([^"]*)"/g)].map((m) => m[1]);
          expect(labels).toEqual(columns);
        }
      }
    }
    expect(tables).toBe(4);
  });
});

describe("community participant onboarding", () => {
  it("renders stored identity, attribution and clear group commands without a join placeholder", () => {
    const html = renderToStaticMarkup(<CommunityView community={f.community} />);
    const t = text(<CommunityView community={f.community} />);
    expect(t).toContain("Start here");
    expect(t).toContain("Hyphae Lab");
    expect(t).toContain("Powered by Hyphae");
    expect(t).toContain("/link");
    expect(t).toContain("wallet app's browser");
    expect(t).toContain("/rules");
    expect(t).toContain("/me");
    expect(t).toContain("ask its owner for an invite");
    expect(t).not.toContain("Pilot");
    expect(html).not.toMatch(/start=link_|\/link#|href="[^"]*(TODO|example\.com)/);
    expect(html).not.toContain(">Join community<");
  });

  it("uses the selected open epoch for audit actions and preserves intake and read time", () => {
    const firstEpoch = f.community.epochs[0];
    if (!firstEpoch) throw new Error("fixture epoch missing");
    const community = {
      ...f.community,
      current_epoch: 7,
      reward_intake: "paused" as const,
      epochs: [{ ...firstEpoch, index: 7, status: "open" as const }],
    };
    const html = renderToStaticMarkup(<CommunityView community={community} />);
    expect(html).toContain(`href="/c/${community.mint}/e/7"`);
    expect(text(<CommunityView community={community} />)).toContain("Reward intake is paused");
    expect(text(<CommunityView community={community} />)).toContain("Data as of");
    expect(html).not.toContain("/e/2");
  });

  it("shows no current shortcut when no epoch is open, including contradictory stale data", () => {
    for (const community of [
      { ...f.community, current_epoch: null, epochs: [] },
      {
        ...f.community,
        epochs: f.community.epochs.map((e) => ({ ...e, status: "closed" as const })),
      },
    ]) {
      const html = renderToStaticMarkup(<CommunityView community={community} />);
      expect(text(<CommunityView community={community} />)).not.toContain("Epoch 2 is open");
      expect(html).not.toContain(">Read this epoch's rules<");
      expect(html).not.toContain(">Open this week's contributions<");
    }
  });

  it("offers only supplied verified join/support actions and configures Pilot per community", () => {
    const presentation = {
      pilot: true,
      telegramInvite: "https://t.me/+FixtureInvite",
      supportUrl: "https://support.test/help",
    };
    const html = renderToStaticMarkup(
      <CommunityView community={f.community} presentation={presentation} />,
    );
    expect(html).toContain("Pilot");
    expect(html).toContain('href="https://t.me/+FixtureInvite"');
    expect(html).toContain('href="https://support.test/help"');
    expect(html).toContain(">Join community<");
    expect(text(<CommunityView community={f.community} presentation={presentation} />)).toContain(
      "Hyphae Lab",
    );
  });

  it("never substitutes MYCEL identity or links for another community", () => {
    const community = { ...f.community, mint: "OtherMint", name: "Another community" };
    const html = renderToStaticMarkup(<CommunityView community={community} />);
    expect(html).toContain("Another community");
    expect(html).toContain('href="/c/OtherMint/e/2"');
    expect(html).not.toMatch(/Hyphae Lab|MYCEL|Pilot/);
  });

  it("explains quality and eligibility without claiming an allocation or payment exists", () => {
    const t = text(<CommunityView community={f.community} />);
    expect(t).toContain("Raw quality");
    expect(t).toContain("credited quality");
    expect(t).toContain("Points do not promise payment");
    expect(t).toContain("confirmed claim receipt");
    expect(t).toContain("/link signs a free readable message");
    expect(t).toContain("/claim later signs a transaction");
    expect(t).not.toMatch(/you are eligible|payment sent|you have passed/i);
  });
});
