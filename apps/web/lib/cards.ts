import type { ContributionV1 } from "@hyphae/core";
import { creditSentence, STATE } from "./format.js";

// A contribution in one line, for its page title and its social card: its score as a sentence, or
// why it has none. With no contribution (the API couldn't be read), a line that claims nothing.
export function contributionCard(c: ContributionV1 | null): { context: string; title: string } {
  if (!c) {
    return {
      context: "A contribution on Hyphae",
      title: "Every score, its reasons, and which one counted.",
    };
  }
  const kind = `${c.kind.charAt(0).toUpperCase()}${c.kind.slice(1)}`;
  return {
    context: `${kind} in epoch ${c.epoch.index}`,
    title: c.selected ? creditSentence(c.selected) : STATE[c.state],
  };
}
