import { describe, expect, it } from "vitest";
import { formatTokens, linkMessage, type SetupState, setupContent } from "./setup-content.js";

const id = "3f1c2a9e-0b4d-4c8e-9f11-2a3b4c5d6e7f";
const base: SetupState = {
  communityId: id,
  name: "Hyphae Lab",
  mint: "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg",
  botUsername: "t_bot",
  joined: true,
  wallet: "none",
  rules: "todo",
  alerts: false,
  replied: false,
  closesAt: new Date("2026-10-09T00:00:00Z"),
  holdMin: "100,000",
};
const state = (patch: Partial<SetupState>): SetupState => ({ ...base, ...patch });

describe("setup checklist", () => {
  it("starts at the wallet with a single next button", () => {
    const { text, buttons } = setupContent(base);
    expect(text).toContain("✅ 1. Joined Hyphae Lab");
    expect(text).toContain("➡️ 2. Link your wallet");
    expect(text).toContain("⬜ 3.");
    expect(buttons.filter((b) => b.primary)).toEqual([
      { label: "Link my wallet", callback: `setup_link_${id}`, primary: true },
    ]);
    expect(buttons.at(-1)).toEqual({ label: "Refresh", callback: `setup_${id}` });
  });

  it("asks a person who has not joined to join first, with no step button", () => {
    const { text, buttons } = setupContent(state({ joined: false }));
    expect(text).toContain("➡️ 1. Join Hyphae Lab");
    expect(buttons.filter((b) => b.primary)).toEqual([]);
  });

  it("moves to the rules test once the wallet is verified", () => {
    const { text, buttons } = setupContent(state({ wallet: "verified" }));
    expect(text).toContain("✅ 2. Wallet verified");
    expect(text).toContain("➡️ 3. Pass the rules test");
    expect(buttons.find((b) => b.primary)).toEqual({
      label: "Take the rules test",
      url: `https://t.me/t_bot?start=rules_${id}`,
      primary: true,
    });
  });

  it("treats a pasted, unsigned wallet as not done", () => {
    const { text } = setupContent(state({ wallet: "unverified" }));
    expect(text).toContain("➡️ 2. Link your wallet");
  });

  it("marks alerts optional and sends people on to their first reply", () => {
    const { text, buttons } = setupContent(state({ wallet: "verified", rules: "passed" }));
    expect(text).toContain("✅ 3. Rules test passed");
    expect(text).toContain("➡️ 4. Raid alerts (optional)");
    expect(buttons.find((b) => b.primary)?.url).toBe(`https://t.me/t_bot?start=raids_${id}`);
  });

  it("finishes with everything done and no step button", () => {
    const { text, buttons } = setupContent(
      state({ wallet: "verified", rules: "passed", alerts: true, replied: true }),
    );
    expect(text).toContain("You are set up");
    expect(buttons.filter((b) => b.primary)).toEqual([]);
  });

  it("says plainly what payment needs, including the token hold", () => {
    const { text } = setupContent(base);
    expect(text).toContain("at least 100,000");
    expect(text).toContain("2026-10-09 00:00 UTC");
    expect(text).toMatch(/points are not a payment/i);
  });

  it("matches the payout gate: signed wallet and rules pass before close, counted points, hold window", () => {
    const { text } = setupContent(base);
    expect(text).toMatch(/linked by signing before 2026-10-09 00:00 UTC/);
    expect(text).toMatch(/rules test passed before 2026-10-09 00:00 UTC/);
    expect(text).toMatch(/at least one reply that counts for points/);
    expect(text).toMatch(/from the close until 24 hours after it/);
    expect(text).toMatch(/read once in that window and the result is final/);
  });

  it("omits the amount when it is unknown rather than guessing one", () => {
    const { text } = setupContent(state({ holdMin: null }));
    expect(text).toContain("minimum balance");
    expect(text).not.toContain("100,000");
  });

  it("drops the hold condition when the rules set no minimum", () => {
    const { text } = setupContent(state({ holdMin: "0" }));
    expect(text).not.toMatch(/community token/);
  });

  it("says when the rules test is not available instead of blocking the checklist", () => {
    const { text, buttons } = setupContent(state({ wallet: "verified", rules: "unavailable" }));
    expect(text).toContain("no rules test is available yet");
    expect(buttons.find((b) => b.primary)?.label).not.toBe("Take the rules test");
  });
});

describe("wallet-link message", () => {
  const html = linkMessage("Hyphae <Lab>", "https://api.hyphae.test/link#abc_DEF-123");

  it("makes the link copyable with one tap and escapes the community name", () => {
    expect(html).toContain("<code>https://api.hyphae.test/link#abc_DEF-123</code>");
    expect(html).toContain("Hyphae &lt;Lab&gt;");
    expect(html).not.toContain("<Lab>");
  });

  it("tells people to use their wallet's browser, because Telegram's cannot sign", () => {
    expect(html).toMatch(/Phantom or Solflare/);
    expect(html).toMatch(/Telegram.s own browser cannot sign/);
    expect(html).toContain("15 minutes");
    expect(html).toMatch(/moves no funds/);
  });

  it("names the tested wallets and promises a confirmation in this chat", () => {
    expect(html).toMatch(/tested with Hyphae/);
    expect(html).toMatch(/confirm here/);
  });
});

describe("hold amount in tokens", () => {
  it("shows the exact pinned amount and never rounds it down", () => {
    expect(formatTokens(100_000_000_000n, 6)).toBe("100,000");
    expect(formatTokens(1_500_000n, 6)).toBe("1.5");
    expect(formatTokens(500_000n, 6)).toBe("0.5");
    expect(formatTokens(1n, 6)).toBe("0.000001");
    expect(formatTokens(5n, 0)).toBe("5");
    expect(formatTokens(0n, 6)).toBe("0");
  });
});
