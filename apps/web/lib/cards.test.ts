import { describe, expect, it } from "vitest";
import * as f from "../components/fixtures.js";
import { contributionCard } from "./cards.js";

describe("contributionCard", () => {
  it("names the work and says its score in the audit page's own sentence", () => {
    expect(contributionCard(f.offTopic)).toEqual({
      context: `Reply in epoch ${f.offTopic.epoch.index}`,
      title: "Raw 84, credited 0: off-topic is a hard zero.",
    });
  });

  it("says why a contribution has no score, never a zero", () => {
    expect(contributionCard(f.pendingAtClose).title).toBe(
      "Not scored before the epoch closed; it earns nothing in this epoch.",
    );
  });

  it("claims nothing when the contribution couldn't be read", () => {
    expect(contributionCard(null).title).not.toMatch(/\d/);
  });
});
