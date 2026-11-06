import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityManagement } from "./community-management.js";
import { community } from "./fixtures.js";

describe("public management overview", () => {
  it("supports an older API with absent optional fields and disabled private controls", () => {
    const html = renderToStaticMarkup(
      <CommunityManagement community={{ ...community, vault: undefined }} />,
    );
    expect(html).toContain("Manage community");
    expect(html).toContain("New submissions are open");
    expect(html).toContain("Vault details are unavailable");
    expect(html).not.toMatch(/Confirm pause|Sign in with|spendable/i);
  });
  it("shows separate exact balance and obligations without an available-to-spend figure", () => {
    const html = renderToStaticMarkup(
      <CommunityManagement
        community={{
          ...community,
          vault: {
            status: "available",
            network: "solana:devnet",
            program_id: "11111111111111111111111111111111",
            community_address: "11111111111111111111111111111111",
            vault_address: "11111111111111111111111111111111",
            admin: "11111111111111111111111111111111",
            fee_recipient: "11111111111111111111111111111111",
            balance_lamports: "9007199254740993000",
            outstanding_lamports: "9007199254740992999",
          },
        }}
      />,
    );
    expect(html).toContain("9007199254.740993 SOL");
    expect(html).toContain("9007199254.740992999 SOL");
    expect(html).toContain("Owed to published epochs");
    expect(html).toContain("cluster=devnet");
    expect(html).not.toMatch(/spendable|available to spend/i);
  });
  it("never invents a funding address when chain reads are unavailable", () => {
    const html = renderToStaticMarkup(
      <CommunityManagement
        community={{ ...community, vault: { status: "unavailable", reason: "chain_unavailable" } }}
      />,
    );
    expect(html).toContain("Do not send SOL");
    expect(html).not.toContain("explorer.solana.com/address");
  });
  it("does not label an expired or absent epoch accepting", () => {
    for (const c of [
      { ...community, as_of: "2026-11-06T18:00:00.000000Z" },
      { ...community, current_epoch: null },
    ]) {
      const html = renderToStaticMarkup(<CommunityManagement community={c} />);
      expect(html).not.toContain("New submissions are open");
    }
  });
  it("escapes untrusted names and keeps a public snapshot timestamp", () => {
    const html = renderToStaticMarkup(
      <CommunityManagement community={{ ...community, name: "<img src=x onerror=alert(1)>" }} />,
    );
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("Public snapshot");
  });
});
