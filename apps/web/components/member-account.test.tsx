import type { MemberAccount } from "@hyphae/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberAccountView } from "./member-account.js";

const community = { mint: "MintA", name: "Fixture" };
const common = { community, as_of: "2026-10-09T12:00:00.000Z" };
describe("member account presentation", () => {
  it("keeps login unavailable without verified configuration", () => {
    const html = renderToStaticMarkup(
      <MemberAccountView community={community} state={{ kind: "disabled" }} />,
    );
    expect(html).toContain("Sign-in is not available yet");
    expect(html).toContain("/c/MintA/join");
    expect(html).toContain('aria-label="Privy sign-in options"');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain("Use an existing Solana wallet");
  });
  it("offers email and existing Solana wallet login without reward-wallet authority", () => {
    const html = renderToStaticMarkup(
      <MemberAccountView community={community} state={{ kind: "logged_out" }} />,
    );
    expect(html).toContain("Sign in with email");
    expect(html).toContain("existing Solana wallet");
    expect(html).toContain("does not set your reward wallet");
  });
  it.each([
    ["telegram_required", "Connect your Telegram membership"],
    ["join_required", "Join the community group"],
    ["member_not_registered", "Finish your member setup"],
  ] as const)("shows the honest next action for %s", (state, text) => {
    const account: MemberAccount = { ...common, state };
    const html = renderToStaticMarkup(
      <MemberAccountView community={community} state={{ kind: "account", account }} />,
    );
    expect(html).toContain(text);
    expect(html).not.toContain("Current reward wallet");
    expect(html).not.toContain("paid");
  });
  it.each(["signature", "paste", "none"] as const)(
    "shows current wallet evidence %s without claiming eligibility",
    (status) => {
      const account: MemberAccount = {
        ...common,
        state: "member",
        wallet: {
          status,
          address: status === "none" ? null : "So11111111111111111111111111111111111111112",
        },
      };
      const html = renderToStaticMarkup(
        <MemberAccountView community={community} state={{ kind: "account", account }} />,
      );
      expect(html).toContain("Current reward wallet");
      expect(html).toContain("not a payment verdict");
      expect(html).toContain("/c/MintA/join");
      if (status === "signature") expect(html).toContain("Signature recorded");
      if (status === "paste") expect(html).toContain("Pasted wallet");
      if (status === "none") expect(html).toContain("No wallet linked");
    },
  );
  it("gives a retry without fabricating membership when a private read fails", () => {
    const html = renderToStaticMarkup(
      <MemberAccountView community={community} state={{ kind: "unavailable" }} />,
    );
    expect(html).toContain("We could not check your membership");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Current reward wallet");
  });
});
