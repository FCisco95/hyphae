import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClaimSummary, ClaimView } from "./claim.js";
import * as f from "./fixtures.js";

const text = (el: React.ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

describe("ClaimView", () => {
  it("offers a claim only for a published epoch", () => {
    const published = text(<ClaimView epoch={f.settledEpoch} />);
    expect(published).toContain("Claim · Epoch 2");
    expect(published).toContain("devnet");
    const retained = text(<ClaimView epoch={f.retainedEpoch} />);
    expect(retained).toContain("Retained: this epoch is before the first paid epoch.");
    expect(retained).not.toContain("Connect");
  });
});

describe("ClaimSummary", () => {
  it("shows what the wallet will sign before it signs: amount, network, who pays", () => {
    const t = text(<ClaimSummary claim={f.claim} />);
    expect(t).toContain("0.12125 SOL");
    expect(t).toContain("devnet");
    expect(t).toContain("Your wallet pays the network fee and the claim receipt's rent");
    expect(t).toContain("Claimable");
  });

  it("shows a paid claim with its transaction, and nothing to sign", () => {
    const html = renderToStaticMarkup(
      <ClaimSummary claim={{ ...f.claim, payment: { status: "paid", claim_tx: f.CLAIM_TX } }} />,
    );
    expect(html).toContain(`https://explorer.solana.com/tx/${f.CLAIM_TX}?cluster=devnet`);
    expect(
      text(
        <ClaimSummary claim={{ ...f.claim, payment: { status: "paid", claim_tx: f.CLAIM_TX } }} />,
      ),
    ).toContain("Paid");
  });

  it("says when the chain cannot confirm the status, and offers nothing to sign", () => {
    const t = text(
      <ClaimSummary
        claim={{ ...f.claim, payment: { status: "unavailable", reason: "chain_unavailable" } }}
      />,
    );
    expect(t).toContain("can't be confirmed on-chain right now");
    expect(t).not.toContain("Claimable");
  });
});
