import { ReadApiV1 } from "@hyphae/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClaimSummary } from "./claim.js";
import { CLAIM_TX, claim, leaderboard, SIGNED } from "./fixtures.js";
import * as f from "./record-fixtures.js";
import { LeaderboardView } from "./views.js";
import { NoRecordView, WalletRecordView } from "./wallet.js";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const text = (el: React.ReactElement) =>
  html(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

describe("record fixtures", () => {
  it("match the strict API schema", () => {
    ReadApiV1.walletRecord.parse(f.record);
    ReadApiV1.walletRecord.parse(f.unsettledRecord);
  });
});

describe("WalletRecordView", () => {
  it("shows the shortened wallet and the totals of every epoch", () => {
    const t = text(<WalletRecordView record={f.record} />);
    expect(t).toContain("MAoR…VhAB");
    expect(t).not.toContain(SIGNED);
    expect(t).toContain("Communities 2");
    expect(t).toContain("Epochs 3");
    expect(t).toContain("Contributions 4 3 scored, 2 credited");
    expect(t).toContain("Average credited score 51.67");
    expect(t).toContain("Exact points 325");
    expect(t).toContain("Data as of 2026-10-10 12:00 UTC.");
  });

  it("links each epoch to its epoch page and each contribution to its receipt", () => {
    const h = html(<WalletRecordView record={f.record} />);
    for (const e of f.record.epochs) {
      expect(h).toContain(`href="/c/${e.community.mint}/e/${e.index}"`);
      for (const c of e.contributions) expect(h).toContain(`href="/contribution/${c.id}"`);
    }
    expect(h).toContain('href="/c/MintXyz"');
  });

  it("shows each epoch's payout: paid with its transaction, claimable, or why there is none", () => {
    const t = text(<WalletRecordView record={f.record} />);
    expect(t).toContain("0.12125 SOL, paid in");
    expect(html(<WalletRecordView record={f.record} />)).toContain(
      `https://explorer.solana.com/tx/${CLAIM_TX}`,
    );
    expect(t).toContain("0.05 SOL allocated, not claimed yet.");
    expect(html(<WalletRecordView record={f.record} />)).toContain('href="/c/MintXyz/e/1/claim"');
    expect(t).toContain("No payout before the epoch closes and is published.");
  });

  it("shows each contribution's state, and no score where none was selected", () => {
    const t = text(<WalletRecordView record={f.record} />);
    expect(t).toContain("Not scored yet.");
    expect(t).toContain("1 contribution: none scored yet.");
    expect(t).toContain("2 contributions: 2 scored, 1 credited.");
  });

  it("never reads as money having moved before anything is settled", () => {
    const t = text(<WalletRecordView record={f.unsettledRecord} />);
    expect(t).not.toMatch(/\bpaid\b|\bclaimed\b|payout sent/i);
    expect(t).toContain("Average credited score —");
    // One community: its totals are the record's, so no communities table.
    expect(t).not.toContain("Other DAO");
  });

  it("shows no Telegram or X identity, nor a contribution's original link", () => {
    const h = html(<WalletRecordView record={f.record} />);
    expect(h).not.toMatch(/x\.com|twitter\.com|t\.me|telegram/i);
  });

  it("pages the epochs and says when a page is empty", () => {
    const paged = { ...f.record, total_epochs: 45, offset: 20, limit: 20 };
    const h = html(<WalletRecordView record={paged} />);
    expect(h).toContain(`href="/wallet/${SIGNED}?offset=0"`);
    expect(h).toContain(`href="/wallet/${SIGNED}?offset=40"`);
    expect(text(<WalletRecordView record={{ ...paged, offset: 60, epochs: [] }} />)).toContain(
      "No epochs on this page.",
    );
  });
});

describe("NoRecordView", () => {
  it("says plainly what is missing and how a record starts", () => {
    const t = text(<NoRecordView />);
    expect(t).toContain("No public record");
    expect(t).toContain("verified by signature");
  });
});

describe("links to a wallet's record", () => {
  it("from a verified wallet on the leaderboard, and from the wallet on the claim page", () => {
    const board = html(<LeaderboardView board={leaderboard} />);
    expect(board).toContain(`href="/wallet/${SIGNED}"`);
    // An unverified wallet has no record to link to.
    expect(board.match(/href="\/wallet\//g)).toHaveLength(1);
    expect(html(<ClaimSummary claim={claim} />)).toContain(`href="/wallet/${claim.wallet}"`);
  });
});
