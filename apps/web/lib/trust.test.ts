import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrustPage } from "../components/trust.js";
import { APP_REPO, GITHUB } from "./links.js";
import {
  ADMIN_LEDGER,
  AI_REVIEW_NOTE,
  FEE_VAULT,
  PROGRAM_ID,
  REPORT_URL,
  TRUST_SECTIONS,
  VERIFIED_HASH,
} from "./trust.js";

const repoRoot = new URL("../../../", import.meta.url);
const security = readFileSync(new URL("docs/SECURITY.md", repoRoot), "utf8");
const claims = TRUST_SECTIONS.flatMap((s) => s.claims);
const hrefs = claims.flatMap((c) => c.evidence.map((e) => e.href));
const allText = [
  ...TRUST_SECTIONS.flatMap((s) => [s.title, s.lead ?? ""]),
  ...claims.map((c) => c.text),
].join("\n");

describe("the security and trust content", () => {
  it("backs every claim with at least one link", () => {
    expect(claims.length).toBeGreaterThan(20);
    for (const c of claims) {
      expect(c.evidence.length, c.text).toBeGreaterThan(0);
      for (const e of c.evidence) expect(e.href, c.text).toMatch(/^https:\/\//);
    }
  });

  it("links only files that exist: the app's in this repo, the program's in its public mirror", () => {
    const appFiles = hrefs.filter((h) => h.startsWith(`${APP_REPO}/blob/main/`));
    const programFiles = hrefs.filter((h) => h.startsWith(`${GITHUB}/blob/main/programs/hyphae/`));
    expect(appFiles.length).toBeGreaterThan(10);
    expect(programFiles.length).toBeGreaterThan(4);
    for (const h of appFiles) {
      expect(existsSync(new URL(h.slice(`${APP_REPO}/blob/main/`.length), repoRoot)), h).toBe(true);
    }
    for (const h of programFiles) {
      expect(existsSync(new URL(h.slice(`${GITHUB}/blob/main/`.length), repoRoot)), h).toBe(true);
    }
  });

  it("names the keys, the program and the build hash exactly", () => {
    expect(allText).toContain(ADMIN_LEDGER);
    expect(allText).toContain(FEE_VAULT);
    expect(allText).toContain(PROGRAM_ID);
    expect(allText).toContain(VERIFIED_HASH);
    expect(hrefs).toContain(`https://explorer.solana.com/address/${ADMIN_LEDGER}`);
    expect(hrefs).toContain(`https://explorer.solana.com/address/${FEE_VAULT}`);
  });

  it("calls the reviews AI reviews, never an audit", () => {
    expect(TRUST_SECTIONS.find((s) => s.id === "reviews")?.lead).toContain(AI_REVIEW_NOTE);
    expect(allText).not.toMatch(/\baudited\b/i);
    expect(allText.match(/third-party audit/g)).toHaveLength(1);
  });

  it("publishes no placeholder", () => {
    for (const text of [allText, security]) {
      expect(text).not.toMatch(/\b(TODO|TBD|FIXME|placeholder|lorem)\b|example\.com|@example/i);
    }
  });

  it("points reports at private vulnerability reporting on the public program repo", () => {
    expect(REPORT_URL).toBe("https://github.com/FCisco95/hyphae-program/security/advisories/new");
    expect(hrefs).toContain(REPORT_URL);
  });
});

describe("docs/SECURITY.md", () => {
  it("says every claim of the page, word for word, with the same links", () => {
    for (const s of TRUST_SECTIONS) {
      expect(security).toContain(`## ${s.title}`);
      if (s.lead) expect(security).toContain(s.lead);
    }
    for (const c of claims) expect(security, c.text).toContain(c.text);
    for (const h of hrefs) expect(security, h).toContain(`(${h})`);
    expect(security).toContain(REPORT_URL);
  });
});

describe("TrustPage", () => {
  it("renders every section, claim and evidence link", () => {
    const html = renderToStaticMarkup(createElement(TrustPage));
    for (const s of TRUST_SECTIONS) {
      expect(html).toContain(`id="${s.id}"`);
      expect(html).toContain(`href="#${s.id}"`);
    }
    for (const h of hrefs) expect(html).toContain(`href="${h.replaceAll("&", "&amp;")}"`);
    expect(html.match(/<li>/g)?.length).toBeGreaterThanOrEqual(claims.length);
  });
});
