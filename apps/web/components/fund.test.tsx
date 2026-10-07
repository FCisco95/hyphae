import type { CommunityV1 } from "@hyphae/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FundPanel } from "./fund.js";

const VAULT = "9VLtVau1tAddre55xxxxxxxxxxxxxxxxxxxxxxxxV";
const available: NonNullable<CommunityV1["vault"]> = {
  status: "available",
  network: "solana:mainnet",
  program_id: "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E",
  community_address: "HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX",
  vault_address: VAULT,
  admin: "2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR",
  fee_recipient: "rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK",
  balance_lamports: "1500000000",
  outstanding_lamports: "250000000",
};
const text = (vault: NonNullable<CommunityV1["vault"]>) =>
  renderToStaticMarkup(<FundPanel vault={vault} />)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

describe("FundPanel", () => {
  it("shows the vault to fund, on which network, with its balance and what epochs still owe", () => {
    const html = renderToStaticMarkup(<FundPanel vault={available} />);
    expect(html).toContain(`href="https://explorer.solana.com/address/${VAULT}"`);
    expect(html).toContain(VAULT);
    const t = text(available);
    expect(t).toContain("Fund this community");
    expect(t).toContain("mainnet");
    expect(t).toContain("1.5 SOL");
    expect(t).toContain("0.25 SOL");
    expect(t).toContain("ordinary SOL transfer");
    expect(t).toContain("3% fee");
  });

  it("links a devnet vault to the devnet explorer", () => {
    const html = renderToStaticMarkup(
      <FundPanel vault={{ ...available, network: "solana:devnet" }} />,
    );
    expect(html).toContain(`href="https://explorer.solana.com/address/${VAULT}?cluster=devnet"`);
  });

  it("tells people not to send SOL before the community is on chain", () => {
    const t = text({ status: "unavailable", reason: "community_not_on_chain" });
    expect(t).toContain("not on Solana yet");
    expect(t).toContain("Do not send SOL");
  });

  it("says the vault cannot be confirmed when the chain cannot be read", () => {
    const t = text({ status: "unavailable", reason: "chain_unavailable" });
    expect(t).toContain("cannot be confirmed right now");
    expect(t).toContain("Do not send SOL");
  });
});
