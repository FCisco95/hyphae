import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClaimSummary, ClaimView } from "./claim.js";
import { NoWallet, SendStatus } from "./claim-panel.js";
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

describe("SendStatus", () => {
  const signature = `5${"S".repeat(86)}`;

  it("keeps a way forward when a sent claim never shows a receipt", () => {
    const html = renderToStaticMarkup(
      <SendStatus
        send={{ state: "unresolved", signature }}
        network="solana:devnet"
        onRecheck={() => {}}
      />,
    );
    expect(html).toContain("Check again");
    expect(
      text(
        <SendStatus
          send={{ state: "unresolved", signature }}
          network="solana:devnet"
          onRecheck={() => {}}
        />,
      ),
    ).toContain("No receipt has appeared on-chain");
  });

  it("offers nothing to press while a claim is on its way", () => {
    const html = renderToStaticMarkup(
      <SendStatus
        send={{ state: "sent", signature }}
        network="solana:devnet"
        onRecheck={() => {}}
      />,
    );
    expect(html).not.toContain("<button");
    expect(html).toContain("Waiting for its receipt");
  });
});

describe("NoWallet", () => {
  it("tells a phone how to reach a wallet, and links back to the epoch", () => {
    const t = text(<NoWallet back="/c/M/e/2" />);
    expect(t).toContain("No Solana wallet");
    expect(t).toContain("open this page in your wallet app's browser");
    expect(renderToStaticMarkup(<NoWallet back="/c/M/e/2" />)).toContain('href="/c/M/e/2"');
  });
});
