import { readFileSync } from "node:fs";
import { CUSTODY_POLICY, CUSTODY_POLICY_URL } from "@hyphae/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LICENSE, MAINNET_RECORD, VERIFY_BUILD } from "../lib/links.js";
import * as f from "./fixtures.js";
import {
  Hero,
  INTEGRATION,
  Integrate,
  MAINNET_RUN,
  Proof,
  Trust,
  VERIFIED_HASH,
} from "./landing.js";
import { SiteFooter } from "./site.js";

const text = (el: React.ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const repo = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
// The live column comes before the mainnet record in the proof section.
const liveColumn = (el: React.ReactElement) =>
  text(el).split("October 10: four wallets paid on mainnet")[0] ?? "";

describe("Hero", () => {
  it("leads to the community and to the claim page", () => {
    const html = renderToStaticMarkup(<Hero communityHref="/c/MintAbc" />);
    expect(html).toContain('href="/c/MintAbc"');
    expect(html).toContain('href="/claim"');
    expect(text(<Hero communityHref="/c/MintAbc" />)).toContain(
      "Proof of contribution for token communities.",
    );
  });

  it("names the program's licence, with a link to it", () => {
    const html = renderToStaticMarkup(<Hero communityHref="/c/MintAbc" />);
    expect(text(<Hero communityHref="/c/MintAbc" />)).toContain("Source available (BUSL 1.1)");
    expect(html).toContain(`href="${LICENSE}"`);
  });
});

describe("the site's licence claims", () => {
  it("never calls Hyphae MIT or open source", () => {
    const all = [
      <Hero key="h" communityHref="/c/MintAbc" />,
      <Proof key="p" live={{ state: "unavailable" }} />,
      <Trust key="t" />,
      <Integrate key="i" />,
      <SiteFooter key="f" />,
    ]
      .map(text)
      .join(" ");
    expect(all).not.toMatch(/\bMIT\b|open source/i);
    expect(text(<SiteFooter />)).toContain("Source available under BUSL 1.1.");
  });
});

describe("Proof", () => {
  it("shows the API's numbers for the open epoch, and what the newest closed one paid", () => {
    const t = liveColumn(
      <Proof
        live={{
          state: "ready",
          community: f.community,
          epoch: f.openEpoch,
          closed: f.settledEpoch,
        }}
      />,
    );
    expect(t).toContain("Hyphae Lab");
    expect(t).toContain("Data as of 2026-10-03 00:00 UTC.");
    expect(t).toContain(`${f.openEpoch.counts.contributions}`);
    expect(t).toContain("Epoch 2 was published on devnet: 0.304603658 SOL allocated to 3 members");
  });

  // W3 of the Sep 28 site review: between the close and the snapshot, the epoch has closed.
  it("says a closing epoch's numbers are on their way, never that nothing has closed", () => {
    const t = liveColumn(
      <Proof
        live={{
          state: "ready",
          community: f.community,
          epoch: f.closingEpoch,
          closed: f.closingEpoch,
        }}
      />,
    );
    expect(t).toContain("Final numbers appear when the snapshot is written");
    expect(t).not.toContain("No epoch has closed yet.");
  });

  it("says why nothing was paid, in the audit page's own words", () => {
    const t = liveColumn(
      <Proof
        live={{
          state: "ready",
          community: f.community,
          epoch: f.openEpoch,
          closed: f.retainedEpoch,
        }}
      />,
    );
    expect(t).toContain("Retained: this epoch is before the first paid epoch.");
  });

  it("shows no number at all when the API can't be read", () => {
    for (const state of ["unavailable", "unconfigured"] as const) {
      const t = liveColumn(<Proof live={{ state }} />).split("Proof you can check")[1] ?? "";
      expect(t).toMatch(/can't be reached|No community is configured/);
      expect(t.replace(/Solana devnet/g, "")).not.toMatch(/\d/);
    }
    const epochDown = liveColumn(
      <Proof
        live={{
          state: "ready",
          community: f.community,
          epoch: "unavailable",
          closed: "unavailable",
        }}
      />,
    );
    expect(epochDown).toContain("This epoch can't be read right now.");
    expect(epochDown).toContain("The newest closed epoch can't be read right now.");
  });

  it("cites all seven mainnet payout transactions, labelled mainnet", () => {
    const record = repo("docs/evidence/2026-10-10-mainnet-payout.md");
    const html = renderToStaticMarkup(<Proof live={{ state: "unavailable" }} />);
    expect(MAINNET_RUN).toHaveLength(7);
    for (const { signature } of MAINNET_RUN) {
      expect(record).toContain(signature);
      expect(html).toContain(`https://explorer.solana.com/tx/${signature}`);
    }
    expect(html.match(/class="net">mainnet</g)).toHaveLength(MAINNET_RUN.length);
    expect(html).toContain(`href="${MAINNET_RECORD}"`);
  });
});

describe("Trust", () => {
  it("quotes the approved custody policy word for word, with a link to it", () => {
    const html = renderToStaticMarkup(<Trust />);
    expect(text(<Trust />)).toContain(CUSTODY_POLICY);
    expect(html).toContain(`href="${CUSTODY_POLICY_URL}"`);
  });

  it("gives the verifiable build's hash as recorded", () => {
    expect(repo("docs/evidence/PROGRAM.md")).toContain(VERIFIED_HASH);
    expect(renderToStaticMarkup(<Trust />)).toContain(`title="${VERIFIED_HASH}"`);
    expect(text(<Trust />)).toContain("The program on mainnet and on devnet is byte for byte");
    expect(renderToStaticMarkup(<Trust />)).toContain(`href="${VERIFY_BUILD}"`);
  });
});

describe("Integrate", () => {
  // W1 of the Sep 28 site review: the funding note says where the program is. The example's
  // wallet-claims route went live with Runbook C's C7, and the program reached mainnet with its
  // C13, so neither carries a not-deployed caveat now. No mainnet community exists yet, so the
  // note tells a funder to check for one.
  it("says where the program is beside the funding note, and where the API docs are", () => {
    const t = text(<Integrate />);
    expect(t).not.toContain("does not serve");
    expect(t).toContain("A wallet with no leaf in a published epoch gets an empty list");
    expect(renderToStaticMarkup(<Integrate />)).toContain('href="https://hyphae-api.fly.dev/docs"');
    expect(t).toContain("The program is on mainnet and on devnet at the same address");
    expect(t).toContain("Check that the community exists on the network you use");
    expect(t).not.toContain("devnet only");
    // The README that explains running the API locally is in the private repo.
    expect(t).not.toContain("run the whole API locally");
  });

  it("shows the README's integration code unchanged", () => {
    const readme = repo("README.md");
    for (const block of INTEGRATION.split("\n\n")) expect(readme).toContain(block);
    expect(text(<Integrate />)).toContain(INTEGRATION.split("\n")[0]);
  });
});
