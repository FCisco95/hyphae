import { readFileSync } from "node:fs";
import { CUSTODY_POLICY, CUSTODY_POLICY_URL } from "@hyphae/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as f from "./fixtures.js";
import {
  DEVNET_RUN,
  Hero,
  INTEGRATION,
  Integrate,
  Proof,
  Trust,
  VERIFIED_HASH,
} from "./landing.js";

const text = (el: React.ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const repo = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
// The live column comes before the devnet record in the proof section.
const liveColumn = (el: React.ReactElement) =>
  text(el).split("A full run on Solana devnet")[0] ?? "";

describe("Hero", () => {
  it("leads to the community and to the claim page", () => {
    const html = renderToStaticMarkup(<Hero communityHref="/c/MintAbc" />);
    expect(html).toContain('href="/c/MintAbc"');
    expect(html).toContain('href="/claim"');
    expect(text(<Hero communityHref="/c/MintAbc" />)).toContain(
      "Proof of contribution for token communities.",
    );
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

  it("cites every devnet transaction from the run 7 record, labelled devnet", () => {
    const record = repo("docs/handoffs/2026-09-27-devnet-proof.md");
    const html = renderToStaticMarkup(<Proof live={{ state: "unavailable" }} />);
    expect(DEVNET_RUN).toHaveLength(5);
    for (const { signature } of DEVNET_RUN) {
      expect(record).toContain(signature);
      expect(html).toContain(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    }
    expect(html.match(/class="net">devnet</g)).toHaveLength(DEVNET_RUN.length);
  });
});

describe("Trust", () => {
  it("quotes the approved custody policy word for word, with a link to it", () => {
    const html = renderToStaticMarkup(<Trust />);
    expect(text(<Trust />)).toContain(CUSTODY_POLICY);
    expect(html).toContain(`href="${CUSTODY_POLICY_URL}"`);
  });

  it("gives the verifiable build's hash as recorded", () => {
    expect(repo("docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md")).toContain(
      VERIFIED_HASH,
    );
    expect(renderToStaticMarkup(<Trust />)).toContain(`title="${VERIFIED_HASH}"`);
  });
});

describe("Integrate", () => {
  it("shows the README's integration code unchanged", () => {
    const readme = repo("README.md");
    for (const block of INTEGRATION.split("\n\n")) expect(readme).toContain(block);
    expect(text(<Integrate />)).toContain(INTEGRATION.split("\n")[0]);
  });
});
