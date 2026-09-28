import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandSprite, MARK_HALF, MARK_SMALL, Mark, WORDMARK_LETTERS } from "./brand.js";

const file = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("the brand files and the components draw the same mark", () => {
  it("the full mark, in the public SVG and both wordmarks", () => {
    for (const svg of [
      "../public/brand/hyphae-mark.svg",
      "../public/brand/hyphae-wordmark.svg",
      "../public/brand/hyphae-wordmark-dark.svg",
    ]) {
      expect(file(svg)).toContain(`d="${MARK_HALF}"`);
    }
  });

  it("the small mark, in its public SVG and the favicon", () => {
    expect(file("../public/brand/hyphae-mark-small.svg")).toContain(`d="${MARK_SMALL}"`);
    expect(file("../app/icon.svg")).toContain(`d="${MARK_SMALL}"`);
  });

  it("every letter of HYPHAE, at its place in both wordmarks", () => {
    expect(WORDMARK_LETTERS).toHaveLength(6);
    for (const svg of [
      "../public/brand/hyphae-wordmark.svg",
      "../public/brand/hyphae-wordmark-dark.svg",
    ]) {
      for (const [x, d] of WORDMARK_LETTERS) {
        expect(file(svg)).toContain(`transform="translate(${x} 176.5)" d="${d}"`);
      }
    }
  });
});

describe("Mark", () => {
  it("draws the traced half and its mirror at x = 256, so it is symmetric by construction", () => {
    const html = renderToStaticMarkup(<Mark size={32} />);
    expect(html).toContain('href="#hyphae-glyph"');
    expect(html).toContain('transform="matrix(-1 0 0 1 512 0)"');
    expect(renderToStaticMarkup(<BrandSprite />)).toContain(`id="hyphae-glyph" d="${MARK_HALF}"`);
  });

  it("is decoration: the link or heading around it carries the name", () => {
    expect(renderToStaticMarkup(<Mark size={32} small />)).toContain('aria-hidden="true"');
  });
});
