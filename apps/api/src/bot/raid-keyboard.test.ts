import { describe, expect, it } from "vitest";
import { raidKeyboard } from "./raid-keyboard.js";

describe("raidKeyboard", () => {
  it("puts one-tap reply and quote on X above the private submit buttons", () => {
    expect(raidKeyboard("hyphaeprotocol_bot", "task-1", "https://x.com/owner/status/7")).toEqual({
      inline_keyboard: [
        [
          { text: "Reply on X", url: "https://x.com/intent/tweet?in_reply_to=7" },
          {
            text: "Quote on X",
            url: "https://x.com/intent/tweet?url=https%3A%2F%2Fx.com%2Fowner%2Fstatus%2F7",
          },
        ],
        [
          {
            text: "Submit my reply privately",
            url: "https://t.me/hyphaeprotocol_bot?start=reply_task-1",
          },
        ],
        [
          {
            text: "Submit my quote privately",
            url: "https://t.me/hyphaeprotocol_bot?start=quote_task-1",
          },
        ],
      ],
    });
  });
});
