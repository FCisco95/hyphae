import { describe, expect, it } from "vitest";
import type { RaidContribution, RaidStats } from "../raid-alerts/stats.js";
import { escapeHtml } from "./html.js";
import { type ResultsRow, rankResults, resultsText } from "./results.js";

const HOUR = 3_600_000;
const P = 100_000_000n; // point units per point
const stats = (s: Partial<RaidStats> = {}): RaidStats => ({
  members: 0,
  replies: 0,
  quotes: 0,
  credited: 0,
  averageCredited: null,
  scoring: 0,
  epochs: [],
  ...s,
});
const row = (
  handle: string | null,
  points: bigint,
  ...posts: ["reply" | "quote", string | null][]
): ResultsRow => ({ handle, points, posts: posts.map(([kind, url]) => ({ kind, url })) });
const base = {
  handle: "organic_mycel",
  ranMs: 24 * HOUR,
  webBase: "https://hyphae.test/",
  mint: "MINT",
};

describe("results text", () => {
  it("counts everyone, names only credited members, medals the top three and folds the rest", () => {
    expect(
      resultsText({
        ...base,
        stats: stats({
          members: 5,
          replies: 4,
          quotes: 3,
          credited: 5,
          averageCredited: 71,
          epochs: [3],
        }),
        rows: [
          row(
            "alice",
            164n,
            ["reply", "https://x.com/alice/status/1"],
            ["quote", "https://x.com/alice/status/2"],
          ),
          row("bob", 150n, ["reply", "https://x.com/bob/status/3"]),
          row("carol", 141n, ["quote", "https://x.com/carol/status/4"]),
          row("dan", 120n, ["reply", "https://x.com/dan/status/5"]),
        ],
      }),
    ).toBe(
      [
        "⚫ <b>Raid results</b>: @organic_mycel (ran 24h)",
        "5 took part · 7 contributions · 5 credited · 2 without credit",
        "Average credited score 71",
        "",
        '🥇 @alice: 164 pts · <a href="https://x.com/alice/status/1">reply</a> · <a href="https://x.com/alice/status/2">quote</a>',
        '🥈 @bob: 150 pts · <a href="https://x.com/bob/status/3">reply</a>',
        '🥉 @carol: 141 pts · <a href="https://x.com/carol/status/4">quote</a>',
        '<blockquote expandable>4. @dan: 120 pts · <a href="https://x.com/dan/status/5">reply</a></blockquote>',
        "Epoch 3 results: https://hyphae.test/c/MINT/e/3",
      ].join("\n"),
    );
  });

  it("says how much is still being scored", () => {
    const text = resultsText({
      ...base,
      stats: stats({
        members: 2,
        replies: 2,
        credited: 1,
        scoring: 1,
        averageCredited: 80,
        epochs: [3],
      }),
      rows: [row("alice", 90n, ["reply", "https://x.com/alice/status/1"])],
    });
    expect(text.split("\n").slice(1, 4)).toEqual([
      "2 took part · 2 contributions · 1 credited · 0 without credit",
      "Average credited score 80",
      "1 still being scored and may be credited later.",
    ]);
  });

  it("says so when nobody submitted and links the community page", () => {
    expect(resultsText({ ...base, stats: stats(), rows: [] })).toBe(
      [
        "⚫ <b>Raid results</b>: @organic_mycel (ran 24h)",
        "No submissions.",
        "Results: https://hyphae.test/c/MINT",
      ].join("\n"),
    );
  });

  it("calls a member with no known handle 'a member' and escapes links", () => {
    const text = resultsText({
      ...base,
      handle: null,
      stats: stats({ members: 2, replies: 2, credited: 2, averageCredited: 70, epochs: [3] }),
      rows: [
        row(null, 90n, ["reply", null]),
        row("eve", 10n, ["reply", "https://x.com/eve/status/6?a=1&b=2"]),
      ],
    });
    expect(text).toContain("⚫ <b>Raid results</b>: this post (ran 24h)");
    expect(text).toContain("🥇 a member: 90 pts · reply");
    expect(text).toContain('href="https://x.com/eve/status/6?a=1&amp;b=2"');
  });

  it("stays within Telegram's 4,096 characters and points to the epoch page for the rest", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      row(
        `member_${i}`,
        BigInt(1000 - i),
        ["reply", `https://x.com/member_${i}/status/${"9".repeat(19)}`],
        ["quote", `https://x.com/member_${i}/status/${"8".repeat(19)}`],
      ),
    );
    const text = resultsText({
      ...base,
      stats: stats({
        members: 60,
        replies: 60,
        quotes: 60,
        credited: 120,
        averageCredited: 75,
        epochs: [3],
      }),
      rows,
    });
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toContain("🥇 @member_0: 1000 pts");
    expect(text).toMatch(
      /\d+ more on the epoch page\.\nEpoch 3 results: https:\/\/hyphae\.test\/c\/MINT\/e\/3$/,
    );
  });

  it("escapes text for Telegram HTML", () => {
    expect(escapeHtml(`<b>"Tom" & Jerry</b>`)).toBe(
      "&lt;b&gt;&quot;Tom&quot; &amp; Jerry&lt;/b&gt;",
    );
  });
});

describe("rankResults", () => {
  const c = (
    memberId: string,
    units: bigint,
    at: number,
    over: Partial<RaidContribution> = {},
  ): RaidContribution => ({
    taskId: "t",
    contributionId: `${memberId}-${at}`,
    memberId,
    kind: "reply",
    url: `https://x.com/${memberId}/status/${at}`,
    handle: memberId,
    submittedAt: new Date(at),
    epochIndex: 3,
    credited: units > 0n,
    scoring: false,
    pointUnits: units,
    creditedQuality: units > 0n ? 80 : null,
    ...over,
  });

  it("sums each member's credited work, best first, and breaks ties by the earlier submission", () => {
    expect(
      rankResults([
        c("bob", 50n * P, 2),
        c("alice", 30n * P, 1),
        c("alice", 20n * P, 5, { kind: "quote", handle: "alice_alt" }),
        c("zed", 0n, 0),
      ]),
    ).toEqual([
      {
        handle: "alice",
        points: 50n,
        posts: [
          { kind: "reply", url: "https://x.com/alice/status/1" },
          { kind: "quote", url: "https://x.com/alice/status/5" },
        ],
      },
      { handle: "bob", points: 50n, posts: [{ kind: "reply", url: "https://x.com/bob/status/2" }] },
    ]);
  });

  it("rounds whole points half up, as the leaderboard does", () => {
    expect(rankResults([c("amy", 150_000_000n, 1)])[0]?.points).toBe(2n);
  });
});
