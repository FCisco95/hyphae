import type { PublicRaid } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import * as f from "../components/fixtures.js";
import { contributionCard, raidCard } from "./cards.js";

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

const raid = (over: Partial<PublicRaid> = {}): PublicRaid => ({
  id: "6f1c1d2e-0000-4000-8000-000000000001",
  status: "open",
  opens_at: "2026-10-14T08:47:00Z",
  closes_at: "2026-10-15T08:47:00Z",
  brief: "",
  post: {
    url: "https://x.com/organic_mycel/status/1",
    handle: "organic_mycel",
    text: "GM Mycelium",
  },
  ...over,
});

describe("raidCard", () => {
  it("shows an open raid's post, length and author", () => {
    expect(raidCard(raid())).toEqual({
      context: "Raid · 24h · @organic_mycel",
      title: "GM Mycelium",
      footer: "Reply or quote it on X, then submit it to the bot.",
      size: "post",
    });
  });

  it("clips a long post to 200 characters", () => {
    const title = raidCard(
      raid({ post: { url: "https://x.com/a/status/1", handle: "a", text: "x".repeat(400) } }),
    )?.title;
    expect(title).toHaveLength(200);
    expect(title?.endsWith("…")).toBe(true);
  });

  it("says a closed raid has closed", () => {
    expect(raidCard(raid({ status: "closed" }))?.footer).toBe("This raid has closed.");
  });

  it("draws nothing for a missing, cancelled, scheduled or postless raid", () => {
    expect(raidCard(undefined)).toBeNull();
    expect(raidCard(raid({ status: "cancelled", post: null }))).toBeNull();
    expect(raidCard(raid({ status: "scheduled" }))).toBeNull();
    expect(raidCard(raid({ post: null }))).toBeNull();
  });
});
