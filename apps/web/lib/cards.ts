import type { ContributionV1 } from "@hyphae/core";
import type { Result } from "./api.js";
import { creditSentence, STATE } from "./format.js";

export interface Card {
  context: string;
  title: string;
  footer: string;
}

// A contribution in one line, for its page title and its social card: its score as a sentence, or
// why it has none. A read that failed says so, and shows nothing in the score's place.
export function contributionCard(r: Result<ContributionV1>): Card {
  if (!r.ok) {
    return r.reason === "not_found"
      ? {
          context: "Contribution not found",
          title: "No contribution has this id.",
          footer: "It may not be a reward epoch or contribution Hyphae serves.",
        }
      : {
          context: "Contribution unavailable",
          title: "This contribution can't be read right now.",
          footer: "Nothing is shown rather than a guess.",
        };
  }
  const c = r.data;
  const kind = `${c.kind.charAt(0).toUpperCase()}${c.kind.slice(1)}`;
  return {
    context: `${kind} in epoch ${c.epoch.index}`,
    title: c.selected ? creditSentence(c.selected) : STATE[c.state],
    footer: "Every revision and its reasoning are on the audit page.",
  };
}
