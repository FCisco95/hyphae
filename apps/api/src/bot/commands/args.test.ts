import { describe, expect, it } from "vitest";
import { parseRaidArgs, parseSubmitArgs } from "./args.js";

describe("/submit args", () => {
  it("a status link is a reply by default", () => {
    expect(parseSubmitArgs("https://x.com/jack/status/20")).toEqual({
      kind: "reply",
      url: "https://x.com/jack/status/20",
    });
  });

  it("a leading 'quote' marks the link as a quote", () => {
    expect(parseSubmitArgs("quote https://x.com/jack/status/20")).toEqual({
      kind: "quote",
      url: "https://x.com/jack/status/20",
    });
    expect(parseSubmitArgs("Quote  https://twitter.com/jack/status/20?s=1")).toEqual({
      kind: "quote",
      url: "https://twitter.com/jack/status/20?s=1",
    });
  });

  it("anything that is not a status link is free-form text", () => {
    expect(parseSubmitArgs("here is a meme idea: mushrooms")).toEqual({
      kind: "text",
      text: "here is a meme idea: mushrooms",
    });
    expect(parseSubmitArgs("quote of the day: gm")).toEqual({
      kind: "text",
      text: "quote of the day: gm",
    });
  });

  it("empty input is null", () => {
    expect(parseSubmitArgs("   ")).toBeNull();
  });
});

describe("/raid args", () => {
  it("url only: window defaults to the rubric's zeroAt, empty brief", () => {
    expect(parseRaidArgs("https://x.com/jack/status/20", 2880)).toEqual({
      url: "https://x.com/jack/status/20",
      hours: 48,
      brief: "",
    });
  });

  it("explicit hours and a brief", () => {
    expect(parseRaidArgs("https://x.com/jack/status/20 6 say something true", 2880)).toEqual({
      url: "https://x.com/jack/status/20",
      hours: 6,
      brief: "say something true",
    });
  });

  it("a brief without hours keeps the default window", () => {
    expect(parseRaidArgs("https://x.com/jack/status/20 be specific", 2880)).toEqual({
      url: "https://x.com/jack/status/20",
      hours: 48,
      brief: "be specific",
    });
  });

  it("rejects a non-status url or a non-positive window", () => {
    expect(parseRaidArgs("https://example.com 4", 2880)).toBeNull();
    expect(parseRaidArgs("https://x.com/jack/status/20 0", 2880)).toBeNull();
    expect(parseRaidArgs("", 2880)).toBeNull();
  });
});
