import { describe, expect, it } from "vitest";
import type { RaidStats } from "../raid-alerts/stats.js";
import {
  type CardView,
  cardCaption,
  cardKeyboard,
  EMPTY_STATS,
  messageLink,
  renderHash,
} from "./render.js";

const CLOSES = new Date("2026-10-15T08:47:00.000Z");
const stats = (s: Partial<RaidStats> = {}): RaidStats => ({ ...EMPTY_STATS, ...s });
const view = (v: Partial<CardView> = {}): CardView => ({
  state: "open",
  handle: "organic_mycel",
  closesAt: CLOSES,
  brief: "",
  fullUntilMinutes: 360,
  stats: stats(),
  ranMs: 0,
  cancelReason: null,
  now: new Date("2026-10-14T14:47:00.000Z"),
  ...v,
});

describe("card caption", () => {
  it("shows a live raid with Telegram's timer, the brief and the decay rule, and no counters yet", () => {
    expect(cardCaption(view({ brief: "Say what you'd build" }), true)).toBe(
      [
        "🔴 <b>Raid live</b>: @organic_mycel",
        `Ends <tg-time unix="${CLOSES.getTime() / 1000}" format="r">2026-10-15 08:47 UTC</tg-time>`,
        "Brief: Say what you'd build",
        "Full credit for the first 6h, then it decays.",
      ].join("\n"),
    );
  });

  it("falls back to whole hours left when captions cannot hold the timer", () => {
    expect(cardCaption(view(), false).split("\n")[1]).toBe("~18h left (ends 2026-10-15 08:47 UTC)");
    expect(
      cardCaption(view({ now: new Date("2026-10-15T08:10:00.000Z") }), false).split("\n")[1],
    ).toBe("Ends within the hour (2026-10-15 08:47 UTC)");
  });

  it("adds the live counters once anyone took part", () => {
    expect(
      cardCaption(
        view({ stats: stats({ members: 7, replies: 5, quotes: 3, averageCredited: 71 }) }),
        true,
      )
        .split("\n")
        .at(-1),
    ).toBe("👥 7 members · 💬 5 replies · 🔁 3 quotes · ⭐ avg 71");
    expect(
      cardCaption(view({ stats: stats({ members: 1, replies: 1 }) }), true)
        .split("\n")
        .at(-1),
    ).toBe("👥 1 member · 💬 1 reply · 🔁 0 quotes");
  });

  it("escapes the brief and clips it so the caption fits 1,024 characters", () => {
    const caption = cardCaption(view({ brief: "<b>&".repeat(500) }), true);
    expect(caption.length).toBeLessThanOrEqual(1024);
    expect(caption).toContain("Brief: &lt;b&gt;&amp;");
    expect(caption).not.toContain("<b>&");
    expect(caption.split("\n")[2]?.endsWith("…")).toBe(true);
  });

  it("closes the card with the run time and the totals", () => {
    expect(
      cardCaption(
        view({
          state: "ended",
          ranMs: 24 * 3_600_000,
          stats: stats({ members: 12, replies: 10, quotes: 8 }),
        }),
      ),
    ).toBe("⚫ <b>Raid closed</b>: @organic_mycel\nRan 24h · 12 members · 18 contributions");
  });

  it("says a raid was cancelled and why, and names an unknown author as this post", () => {
    expect(
      cardCaption(view({ state: "cancelled", handle: null, cancelReason: "Wrong <post>" })),
    ).toBe("Raid cancelled: this post\nWrong &lt;post&gt;");
  });
});

describe("card keyboard", () => {
  it("puts blue X buttons above green private submit buttons while open", () => {
    expect(
      cardKeyboard("open", "hyphae_bot", "task-1", "https://x.com/owner/status/7", null)
        .inline_keyboard,
    ).toEqual([
      [
        {
          text: "💬 Reply on X",
          url: "https://x.com/intent/tweet?in_reply_to=7",
          style: "primary",
        },
        {
          text: "🔁 Quote on X",
          url: "https://x.com/intent/tweet?url=https%3A%2F%2Fx.com%2Fowner%2Fstatus%2F7",
          style: "primary",
        },
      ],
      [
        {
          text: "✅ Submit reply",
          url: "https://t.me/hyphae_bot?start=reply_task-1",
          style: "success",
        },
        {
          text: "✅ Submit quote",
          url: "https://t.me/hyphae_bot?start=quote_task-1",
          style: "success",
        },
      ],
    ]);
  });

  it("drops the buttons once closed, then offers only the results", () => {
    expect(
      cardKeyboard("ended", "b", "t", "https://x.com/o/status/1", null).inline_keyboard,
    ).toEqual([]);
    expect(
      cardKeyboard("cancelled", "b", "t", "https://x.com/o/status/1", null).inline_keyboard,
    ).toEqual([]);
    expect(
      cardKeyboard("ended", "b", "t", "https://x.com/o/status/1", "https://t.me/c/1/9")
        .inline_keyboard,
    ).toEqual([[{ text: "📊 Results", url: "https://t.me/c/1/9" }]]);
  });

  it("links a supergroup message, and nothing in a basic group", () => {
    expect(messageLink(-1001234567890n, 77)).toBe("https://t.me/c/1234567890/77");
    expect(messageLink(-4567n, 1)).toBeNull();
  });

  it("hashes what was drawn", () => {
    const a = cardKeyboard("ended", "b", "t", "https://x.com/o/status/1", null);
    const b = cardKeyboard("ended", "b", "t", "https://x.com/o/status/1", "https://t.me/c/1/9");
    expect(renderHash("x", a)).toBe(renderHash("x", a));
    expect(renderHash("x", a)).not.toBe(renderHash("x", b));
    expect(renderHash("x", a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
