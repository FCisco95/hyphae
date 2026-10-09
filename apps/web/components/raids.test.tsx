import type { PublicRaids } from "@hyphae/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommunityOverview, JoinView } from "./community.js";
import { community } from "./fixtures.js";
import { RaidsView } from "./raids.js";

vi.mock("./raid-refresh.js", () => ({ RaidRefresh: () => null }));
const feed: PublicRaids = {
  community: { mint: community.mint },
  reward_intake: "open",
  as_of: community.as_of,
  raids: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      status: "open",
      opens_at: "2026-10-09T12:00:00Z",
      closes_at: "2026-10-10T12:00:00Z",
      brief: "Explain your approach",
      post: {
        url: "https://x.com/owner/status/123",
        handle: "owner",
        text: "A public post <script>alert('x')</script>",
      },
    },
  ],
};
const fixtureEpoch = community.epochs[0];
if (!fixtureEpoch) throw new Error("Missing fixture epoch");

describe("raid workspace", () => {
  it("shows real post text and deadlines safely, with a distinct epoch cutoff and account entry", () => {
    const html = renderToStaticMarkup(
      <RaidsView community={community} result={{ ok: true, data: feed }} />,
    );
    expect(html).toContain("Live raids");
    expect(html).toContain("Post by @owner");
    expect(html).toContain("2026-10-10T12:00:00Z");
    expect(html).toContain("https://x.com/owner/status/123");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("platform.twitter.com");
    expect(html).toContain("does not extend reward intake");
    expect(html).toContain(`/c/${community.mint}/me`);
    expect(html).toContain("via Privy) is not available yet");
  });
  it("does not turn an unavailable or wrong-community feed into no open raids", () => {
    for (const result of [
      { ok: false as const, reason: "unavailable" as const },
      { ok: true as const, data: { ...feed, community: { mint: "OtherMint" } } },
    ]) {
      const html = renderToStaticMarkup(<RaidsView community={community} result={result} />);
      expect(html).toContain("Raids are unavailable");
      expect(html).not.toContain("No open raids");
      expect(html).not.toContain("Post by @owner");
    }
  });
  it("shows an honest empty state for an actual successful empty feed", () => {
    const html = renderToStaticMarkup(
      <RaidsView community={community} result={{ ok: true, data: { ...feed, raids: [] } }} />,
    );
    expect(html).toContain("No open raids right now");
    expect(html).not.toContain("Raids are unavailable");
  });
  it("never encourages submissions during pause, or for closed or scheduled raids", () => {
    for (const input of [
      { ...feed, reward_intake: "paused" as const },
      { ...feed, raids: feed.raids.map((raid) => ({ ...raid, status: "cancelled" as const })) },
      { ...feed, raids: feed.raids.map((raid) => ({ ...raid, status: "scheduled" as const })) },
    ]) {
      const html = renderToStaticMarkup(
        <RaidsView community={community} result={{ ok: true, data: input }} />,
      );
      expect(html).not.toContain("How to submit your work");
      if (input.reward_intake === "paused") expect(html).toContain("Reward intake is paused");
    }
  });
});
it("does not offer reward submissions after a cutoff even when the community read still says open", () => {
  const current = community.epochs.find((epoch) => epoch.index === community.current_epoch);
  if (!current) throw new Error("Missing fixture epoch");
  const html = renderToStaticMarkup(
    <RaidsView
      community={community}
      result={{ ok: true, data: { ...feed, as_of: current.closes_at } }}
    />,
  );
  expect(html).not.toContain("How to submit your work");
  expect(html).toContain("closed at");
});

it("keeps overview prompts and heading consistent with a newer feed at the epoch cutoff", () => {
  const html = renderToStaticMarkup(
    <CommunityOverview
      community={community}
      raids={{ ok: true, data: { ...feed, as_of: fixtureEpoch.closes_at } }}
    />,
  );
  expect(html).not.toContain("Ready to contribute?");
  expect(html).not.toContain("Find a raid");
  expect(html).not.toContain("Epoch 2 is open.");
  expect(html).toContain("Epoch 2 reward intake has closed.");
  expect(html).toContain("Prepare for the next epoch.");
  expect(html).toContain(`/c/${community.mint}/e/2`);
});

it("does not advertise participation when the overview feed is paused, unavailable or for another community", () => {
  for (const raids of [
    { ok: true as const, data: { ...feed, reward_intake: "paused" as const } },
    { ok: false as const, reason: "unavailable" as const },
    { ok: true as const, data: { ...feed, community: { mint: "OtherMint" } } },
  ]) {
    const html = renderToStaticMarkup(<CommunityOverview community={community} raids={raids} />);
    expect(html).not.toContain("Ready to contribute?");
    expect(html).not.toContain("Find a raid");
    if (raids.ok && raids.data.reward_intake === "paused")
      expect(html).toContain("Reward intake is paused.");
    else {
      expect(html).toContain("Live raid status is unavailable right now.");
      expect(html).toContain("Reward intake cannot be confirmed right now.");
      expect(html).not.toContain("Prepare for the next epoch.");
      expect(html).not.toContain("Reward intake is open.");
    }
  }
});

it("keeps the join guide available but stops submission instructions at the recorded cutoff", () => {
  const html = renderToStaticMarkup(
    <JoinView community={{ ...community, as_of: fixtureEpoch.closes_at }} />,
  );
  expect(html).not.toContain("Epoch 2 is open.");
  expect(html).not.toContain("use that raid");
  expect(html).toContain("Reward submissions are not open right now");
  expect(html).toContain("/link");
  expect(html).toContain("/rules");
});

it("uses closed intake wording throughout after cutoff even if either read is paused", () => {
  for (const input of [
    { community: { ...community, reward_intake: "paused" as const }, data: feed },
    { community, data: { ...feed, reward_intake: "paused" as const } },
  ]) {
    const html = renderToStaticMarkup(
      <CommunityOverview
        community={input.community}
        raids={{
          ok: true,
          data: { ...input.data, as_of: fixtureEpoch.closes_at },
        }}
      />,
    );
    expect(html).toContain("Epoch 2 reward intake has closed.");
    expect(html).toContain("Reward intake is closed.");
    expect(html).toContain("Prepare for the next epoch.");
    expect(html).not.toContain("Reward intake is paused.");
    expect(html).not.toContain('class="small muted">Closes ');
    expect(html).toContain("Closed ");
  }
});

it("explains deliberately withheld scheduled and cancelled post details", () => {
  for (const status of ["scheduled", "cancelled"] as const) {
    const html = renderToStaticMarkup(
      <RaidsView
        community={community}
        result={{
          ok: true,
          data: {
            ...feed,
            raids: feed.raids.map((raid) => ({ ...raid, status, post: null, brief: "" })),
          },
        }}
      />,
    );
    expect(html).not.toContain("The original post link is unavailable.");
    expect(html).toContain(
      status === "scheduled"
        ? "Post details appear when this raid opens."
        : "Post details are hidden for cancelled raids.",
    );
  }
});
