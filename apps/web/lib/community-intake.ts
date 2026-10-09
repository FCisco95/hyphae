import type { CommunityV1, PublicRaids } from "@hyphae/core";
import type { Result } from "./api.js";

export function communityIntake(community: CommunityV1, raids?: Result<PublicRaids>) {
  const epoch = community.epochs.find(
    (item) => item.index === community.current_epoch && item.status === "open",
  );
  const feed = raids?.ok && raids.data.community.mint === community.mint ? raids.data : null;
  const asOf =
    feed && Date.parse(feed.as_of) > Date.parse(community.as_of) ? feed.as_of : community.as_of;
  const expired = !!epoch && Date.parse(epoch.closes_at) <= Date.parse(asOf);
  const paused = community.reward_intake === "paused" || feed?.reward_intake === "paused";
  // An overview needs its raid read too; join/context pages rely on the community read.
  const state = expired
    ? "closed"
    : paused
      ? "paused"
      : !epoch
        ? "none"
        : raids !== undefined && !feed
          ? "unconfirmed"
          : "accepting";
  return { epoch, feed, asOf, expired, paused, state, accepting: state === "accepting" };
}
