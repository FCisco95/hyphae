import { describe, expect, it } from "vitest";
import config from "./next.config.js";

describe("next.config", () => {
  it("sends the bot's score links to the contribution page", async () => {
    expect(await config.redirects?.()).toContainEqual({
      source: "/x/:id",
      destination: "/contribution/:id",
      permanent: true,
    });
  });
});
