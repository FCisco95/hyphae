import { describe, expect, it } from "vitest";
import { copyNormalize, firstCopyOf, isCopy } from "./copy-match.js";

const ORIGINAL =
  "Epoch rewards only count what the scorer can verify: the snapshot closes at 00:00Z and holds are read inside the 24 h window after it.";

describe("copyNormalize", () => {
  it("ignores case, spacing, links, mentions and emoji", () => {
    expect(copyNormalize("  Hello   @someone WORLD 🚀 https://t.co/abc123 \n")).toBe("hello world");
  });

  it("keeps the words themselves", () => {
    expect(copyNormalize("Snapshot closes at 00:00Z.")).toBe("snapshot closes at 00:00z.");
  });
});

describe("isCopy", () => {
  it("marks an identical post as a copy", () => {
    expect(isCopy(ORIGINAL, ORIGINAL)).toBe(true);
  });

  it("marks a post that differs only in case, spacing, link, mention or emoji as a copy", () => {
    const dressed = `@hyphae ${ORIGINAL.toUpperCase().replace(/ /g, "  ")} 🔥 https://x.com/a/status/1`;
    expect(isCopy(dressed, ORIGINAL)).toBe(true);
  });

  it("marks a copy with a few words changed as a copy", () => {
    expect(isCopy(ORIGINAL.replace("verify", "check"), ORIGINAL)).toBe(true);
  });

  it("does not mark a reply on the same topic in other words as a copy", () => {
    const similar =
      "Holds are read after the snapshot closes, so the scorer only counts what it can verify in that window.";
    expect(isCopy(similar, ORIGINAL)).toBe(false);
  });

  it("does not mark a reply that quotes the original and adds more as a copy", () => {
    const longer = `${ORIGINAL} But a wallet that moved tokens out before the read still looks eligible, which the rules do not say.`;
    expect(isCopy(longer, ORIGINAL)).toBe(false);
  });

  it("does not use length as a signal: a long post is compared like a short one", () => {
    const long = `${ORIGINAL} ${"The hold window needs a wallet that stays funded. ".repeat(40)}`;
    expect(isCopy(long, long)).toBe(true);
    expect(isCopy(`${long}extra detail nobody else wrote`, long)).toBe(true);
    expect(isCopy(long.slice(0, long.length / 2), long)).toBe(false);
  });

  it("sits exactly on the threshold: 95% is a copy, 94% is not", () => {
    const base = "a".repeat(100);
    expect(isCopy(`${"b".repeat(5)}${"a".repeat(95)}`, base)).toBe(true);
    expect(isCopy(`${"b".repeat(6)}${"a".repeat(94)}`, base)).toBe(false);
  });

  it("ignores keycap emoji and every kind of link", () => {
    expect(isCopy("gm builders", "gm builders 1️⃣2️⃣3️⃣")).toBe(true);
    expect(isCopy("gm builders", "gm builders pic.twitter.com/abcdefghijk")).toBe(true);
    expect(isCopy("gm builders", "gm builders www.example.com/a")).toBe(true);
    expect(isCopy("gm builders", "gm builders example.com/some/path?x=1")).toBe(true);
    expect(isCopy("gm builders", "gm builders pic.x.com/zzz")).toBe(true);
  });

  it("stays fast on the longest posts: identical, lightly edited and unrelated", () => {
    const word = "snapshot closes at midnight and holds are read after it. ";
    const long = word.repeat(Math.ceil(25_000 / word.length)).slice(0, 25_000);
    const edited = `${"x".repeat(900)}${long.slice(900)}`;
    const unrelated = "zq".repeat(12_500);
    const started = performance.now();
    for (let i = 0; i < 5; i++) {
      expect(isCopy(long, long)).toBe(true);
      expect(isCopy(edited, long)).toBe(true);
      expect(isCopy(unrelated, long)).toBe(false);
    }
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("ignores a bare domain and the tag characters of a flag emoji", () => {
    const base = "The snapshot closes at midnight.";
    expect(isCopy(`${base} example.com`, base)).toBe(true);
    expect(isCopy(`${base} www.example.org`, base)).toBe(true);
    // England's flag: a black flag, then the tag characters for "gbeng" and the cancel tag.
    const england = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
    expect(isCopy(`${base} ${england}`, base)).toBe(true);
    // A word that merely follows a full stop is not a domain.
    expect(copyNormalize("closes at midnight.then holds")).toContain("then holds");
  });

  it("ignores a link whatever follows its domain and any country domain", () => {
    const base = "The snapshot closes at midnight.";
    for (const suffix of [
      " example.com?ref=12345",
      " example.com#details",
      " example.pt",
      " example.co.uk/a?b=c#d",
      " https://example.com:8080/x?y=1",
    ]) {
      expect(isCopy(`${base}${suffix}`, base), suffix).toBe(true);
    }
    expect(copyNormalize("closes at midnight.then holds")).toContain("then holds");
    expect(copyNormalize("a.m. and p.m. and e.g. and i.e.")).toContain("and");
  });

  it("ignores emoji that Unicode compatibility folding would turn into text", () => {
    const base = "The snapshot closes at midnight.";
    expect(isCopy(`${base} ™️`, base)).toBe(true);
    expect(isCopy(`${base} ‼️`, base)).toBe(true);
    expect(isCopy(`${base} ©️ ®️`, base)).toBe(true);
  });

  it("settles scattered edits in a 25k-character post quickly", () => {
    const long = "the snapshot closes at midnight and holds are read after it. ".repeat(410);
    const substituted = [...long].map((c, i) => (i % 21 === 0 ? "b" : c)).join("");
    const deleted = [...long].filter((_, i) => i % 25 !== 0).join("");
    const started = performance.now();
    expect(isCopy(substituted, long)).toBe(true);
    expect(isCopy(deleted, long)).toBe(true);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("never treats a post with nothing left after normalizing as a copy", () => {
    expect(isCopy("🚀 https://t.co/x @a", "🔥 https://t.co/y @b")).toBe(false);
    expect(isCopy("", "")).toBe(false);
  });
});

describe("firstCopyOf", () => {
  const earlier = [
    { id: "a", text: "gm builders, shipping the claim flow today" },
    { id: "b", text: ORIGINAL },
    { id: "c", text: ORIGINAL.replace("verify", "check") },
  ];

  it("returns the earliest earlier post it copies", () => {
    expect(firstCopyOf(ORIGINAL, earlier)?.id).toBe("b");
  });

  it("returns undefined when nothing earlier is a copy", () => {
    expect(
      firstCopyOf("A different and specific point about vault rent.", earlier),
    ).toBeUndefined();
  });
});
