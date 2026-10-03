import { describe, expect, it } from "vitest";
import {
  briefContent,
  helpContent,
  PARTICIPANT_KEYS,
  welcomeContent,
} from "./onboarding-content.js";

const community = {
  name: "Hyphae Lab",
  mint: "MintAbc",
  webOrigin: "https://hyphae.test",
  paused: false,
  epoch: {
    index: 2,
    closesAt: new Date("2026-10-09T00:00:00Z"),
    rubricVersion: "1.2.0",
    rulesQuestions: 6,
  },
};

describe("participant guidance", () => {
  it("makes every quick action an existing command, with brief/help as presentation", () => {
    expect(PARTICIPANT_KEYS.flat()).toEqual(["/link", "/rules", "/me", "/help brief", "/help"]);
    const text = welcomeContent(community);
    for (const command of PARTICIPANT_KEYS.flat()) expect(text).toContain(command);
    expect(text).toContain("Hyphae Lab");
    expect(text).toContain("Powered by Hyphae");
    expect(text).not.toContain("Pilot");
    expect(text).toContain("ORIGINAL private bot URL");
    expect(text).toContain("Never forward");
  });

  it("does not assign a community to a private or unregistered context", () => {
    for (const text of [welcomeContent(), helpContent()]) {
      expect(text).toContain("registered community group");
      expect(text).not.toMatch(/MYCEL|Hyphae Lab|MintAbc|start=|\/link#/);
      expect(text).not.toContain("https://t.me/");
    }
  });

  it("names actual pinned rules without inventing a private completion status", () => {
    const text = helpContent(community);
    expect(text).toContain("Rubric 1.2.0");
    expect(text).toContain("6/6");
    expect(text).toContain("strictly before");
    expect(text).not.toMatch(/you passed|your score is|you are eligible/i);
    expect(text).not.toContain("100,000");
  });

  it("keeps score, allocation, claimable publication and confirmed payment distinct", () => {
    const text = helpContent(community);
    expect(text).toContain("Raw quality");
    expect(text).toContain("Credited quality");
    expect(text).toContain("whole-point rounding");
    expect(text).toContain("Pending");
    expect(text).toContain("provisional");
    expect(text).toContain("Allocation");
    expect(text).toContain("claimable");
    expect(text).toContain("Paid requires a confirmed claim receipt");
    expect(text).toContain("/link signs a free readable message");
    expect(text).toContain("/claim later signs a transaction");
  });

  it("handles pause, missing epoch and unavailable rules honestly", () => {
    expect(welcomeContent({ ...community, paused: true })).toContain("paused");
    const none = helpContent({ ...community, epoch: null });
    expect(none).toContain("No reward epoch is open");
    expect(none).not.toContain("6/6");
    expect(none).not.toContain("/e/2");
    const unsupported = helpContent({
      ...community,
      epoch: { ...community.epoch, rulesQuestions: null },
    });
    expect(unsupported).toContain("No rules test available; ask the owner");
    expect(unsupported).not.toContain("6/6");
  });

  it("keeps another community's name and audit mint, without MYCEL leakage", () => {
    const text = welcomeContent({ ...community, name: "Another community", mint: "OtherMint" });
    expect(text).toContain("Another community");
    expect(text).toContain("https://hyphae.test/c/OtherMint");
    expect(text).not.toMatch(/MintAbc|Hyphae Lab|MYCEL/);
  });

  it("shows only the supplied active brief, UTC deadline and audit destination", () => {
    const text = briefContent(community, {
      brief: "Explain the actual update",
      targetUrl: "https://x.com/owner/status/123",
      closesAt: new Date("2026-10-04T10:00:00Z"),
    });
    expect(text).toContain("Explain the actual update");
    expect(text).toContain("https://x.com/owner/status/123");
    expect(text).toContain("2026-10-04 10:00 UTC");
    expect(text).toContain("one active brief");
    expect(briefContent(community, null)).toContain("No active brief");
  });

  it("bounds untrusted plain text and refuses unsafe configured audit/target URLs", () => {
    const text = briefContent(
      { ...community, name: "<b>Other</b>", webOrigin: "https://user:pw@evil.test" },
      {
        brief: "x".repeat(6000),
        targetUrl: "javascript:alert(1)",
        closesAt: new Date(),
      },
    );
    expect(text).toContain("<b>Other</b>");
    expect(text.length).toBeLessThan(4096);
    expect(text).not.toMatch(/javascript:|pw@evil|start=|\/link#/);
  });
});
