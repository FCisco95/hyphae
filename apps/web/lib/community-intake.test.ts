import type { PublicRaids } from "@hyphae/core";
import { expect, it } from "vitest";
import { community } from "../components/fixtures.js";
import { communityIntake } from "./community-intake.js";

const feed: PublicRaids = {
  community: { mint: community.mint },
  reward_intake: "open",
  as_of: community.as_of,
  raids: [],
};
const fixtureEpoch = community.epochs[0];
if (!fixtureEpoch) throw new Error("Missing fixture epoch");

it("never rewinds the community clock with an older feed", () => {
  const input = { ...community, as_of: fixtureEpoch.closes_at };
  const intake = communityIntake(input, { ok: true, data: feed });
  expect(intake.expired).toBe(true);
  expect(intake.accepting).toBe(false);
  expect(intake.asOf).toBe(input.as_of);
});

it("ignores a different community's timestamp and pause", () => {
  const intake = communityIntake(community, {
    ok: true,
    data: {
      ...feed,
      community: { mint: "OtherMint" },
      as_of: fixtureEpoch.closes_at,
      reward_intake: "paused",
    },
  });
  expect(intake.expired).toBe(false);
  expect(intake.paused).toBe(false);
  expect(intake.asOf).toBe(community.as_of);
  expect(intake.feed).toBeNull();
  expect(intake.accepting).toBe(false);
});

it("requires a selected open epoch and respects either read's pause", () => {
  expect(communityIntake(community).accepting).toBe(true);
  expect(communityIntake({ ...community, current_epoch: null }).accepting).toBe(false);
  expect(
    communityIntake({ ...community, reward_intake: "paused" }, { ok: true, data: feed }).accepting,
  ).toBe(false);
  expect(
    communityIntake(community, { ok: true, data: { ...feed, reward_intake: "paused" } }).accepting,
  ).toBe(false);
});
