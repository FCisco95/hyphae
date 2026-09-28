import { describe, expect, it } from "vitest";
import * as f from "../components/fixtures.js";
import { contributionCard } from "./cards.js";

describe("contributionCard", () => {
  it("names the work and says its score in the audit page's own sentence", () => {
    expect(contributionCard({ ok: true, data: f.offTopic })).toEqual({
      context: `Reply in epoch ${f.offTopic.epoch.index}`,
      title: "Raw 84, credited 0: off-topic is a hard zero.",
      footer: "Every revision and its reasoning are on the audit page.",
    });
  });

  it("says why a contribution has no score, never a zero", () => {
    expect(contributionCard({ ok: true, data: f.pendingAtClose }).title).toBe(
      "Not scored before the epoch closed; it earns nothing in this epoch.",
    );
  });

  // W2 of the Sep 28 site review: a failed read must read as one, not as an ordinary card.
  it("says the contribution couldn't be read, and shows nothing in its place", () => {
    const card = contributionCard({ ok: false, reason: "unavailable" });
    expect(card).toEqual({
      context: "Contribution unavailable",
      title: "This contribution can't be read right now.",
      footer: "Nothing is shown rather than a guess.",
    });
  });

  it("says when no contribution has the id", () => {
    expect(contributionCard({ ok: false, reason: "not_found" })).toMatchObject({
      context: "Contribution not found",
      title: "No contribution has this id.",
    });
  });
});
