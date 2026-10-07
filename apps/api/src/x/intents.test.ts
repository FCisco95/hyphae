import { describe, expect, it } from "vitest";
import { engageLinks } from "./intents.js";

describe("engageLinks", () => {
  it("opens X's composer as a reply to the raid post, and as a quote of it", () => {
    expect(engageLinks("https://x.com/organic_mycel/status/2107411901315469650")).toEqual([
      { label: "Reply on X", url: "https://x.com/intent/tweet?in_reply_to=2107411901315469650" },
      {
        label: "Quote on X",
        url: "https://x.com/intent/tweet?url=https%3A%2F%2Fx.com%2Forganic_mycel%2Fstatus%2F2107411901315469650",
      },
    ]);
  });

  it("quotes the canonical post address whatever host or query the raid used", () => {
    const [, quote] = engageLinks("https://mobile.twitter.com/jack/status/20?s=46&t=abc");
    expect(quote?.url).toBe(
      "https://x.com/intent/tweet?url=https%3A%2F%2Fx.com%2Fjack%2Fstatus%2F20",
    );
  });

  it("falls back to opening the post when the address is not an X post", () => {
    expect(engageLinks("https://example.org/post/1")).toEqual([
      { label: "Open the post", url: "https://example.org/post/1" },
    ]);
  });
});
