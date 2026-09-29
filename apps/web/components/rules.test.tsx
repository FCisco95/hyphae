import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GITHUB } from "../lib/links.js";
import { EXAMPLES } from "../lib/rules.js";
import { RulesView } from "./rules.js";
import { SiteHeader } from "./site.js";

const text = (el: React.ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const headings = (el: React.ReactElement) =>
  [...renderToStaticMarkup(el).matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1]);
const PRICE_120 = "say where its price is going or name targets, even with reasons";
const NOTE_120 = "Under rubric 1.2.0 this reply is a breach and earns 0";

const versionHeadings = (el: React.ReactElement) =>
  headings(el).filter((h) => /1\.2\.0|1\.3\.1/.test(h ?? ""));
const PLAN_13 = "Planned for epoch 4, from 2026-10-16, once the change is proposed and accepted.";

describe("the rules study page", () => {
  it("before epoch 4, keeps the rules now apart from the rules planned for epoch 4", () => {
    const page = <RulesView status={{ state: "known", epoch: 3, now: "1.2.0" }} />;
    expect(versionHeadings(page)).toEqual([
      "The rules now: rubric 1.2.0",
      "Planned for epoch 4: rubric 1.3.1",
    ]);
    const t = text(page);
    expect(t).toContain("Epoch 3 is open now and scored under rubric 1.2.0.");
    expect(t).toContain(PRICE_120);
    expect(t).toContain(PLAN_13);
    expect(t).toContain(NOTE_120);
  });

  // The page never asserts the activation it has not read: a slipped O4 proposal leaves epoch 4
  // on 1.2.0, and 1.3.1 may take effect at any later epoch.
  it("if epoch 4 opens under 1.2.0, still shows 1.2.0 as now and 1.3.1 as only planned", () => {
    const page = <RulesView status={{ state: "known", epoch: 4, now: "1.2.0" }} />;
    expect(versionHeadings(page)).toEqual(["The rules now: rubric 1.2.0", "Planned: rubric 1.3.1"]);
    const t = text(page);
    expect(t).toContain("Planned, and not in force yet.");
    expect(t).not.toContain(PLAN_13);
  });

  it.each([4, 6])(
    "once 1.3.1 is in force (epoch %i), shows it as now and 1.2.0 as earlier",
    (epoch) => {
      const page = <RulesView status={{ state: "known", epoch, now: "1.3.1" }} />;
      expect(versionHeadings(page)).toEqual([
        "The rules now: rubric 1.3.1",
        "Earlier rules: rubric 1.2.0",
      ]);
      const t = text(page);
      expect(t).toContain(`Epoch ${epoch} is open now and scored under rubric 1.3.1.`);
      expect(t).not.toContain(NOTE_120);
      expect(t).not.toMatch(/(before|from|planned for) epoch 4/i);
    },
  );

  it.each([
    [{ state: "unknown" } as const, "Could not read which rubric the open epoch uses"],
    [
      { state: "other", epoch: 5, version: "1.4.0" } as const,
      "Epoch 5 is scored under rubric 1.4.0, which this page does not cover yet",
    ],
  ])("says so when it cannot tell which rules apply (%#)", (status, banner) => {
    const page = <RulesView status={status} />;
    const t = text(page);
    expect(t).toContain(banner);
    expect(versionHeadings(page)).toEqual(["Rubric 1.2.0", "Rubric 1.3.1"]);
    // True whether or not 1.3.1 has taken effect.
    expect(t).toContain(
      "Rubric 1.3.1 replaces 1.2.0 from the epoch its proposal activates; the plan is epoch 4, from 2026-10-16.",
    );
    expect(t).not.toContain(PLAN_13);
    expect(t).not.toContain("not in force yet");
  });

  it("shows every graded example with the founder's grade and its credit", () => {
    const t = text(<RulesView status={{ state: "known", epoch: 3, now: "1.2.0" }} />);
    for (const e of EXAMPLES) expect(t).toContain(e.reply);
    expect(t).toContain("Founder's grade 90 · credited 90");
    expect(t).toContain("Founder's grade 75–80 · credited 75–80");
    expect(t).toContain("Founder's grade 50 · credited 0: guideline breach");
    expect(t).toContain(
      "Founder's grade 70 · credited 0: reads AI-written, capped at 40, below the 60 floor",
    );
  });

  it("links both rubrics and makes no claim the code does not keep", () => {
    const page = <RulesView status={{ state: "known", epoch: 3, now: "1.2.0" }} />;
    const html = renderToStaticMarkup(page);
    expect(html).toContain(`href="${GITHUB}/blob/main/rubrics/mycel-1.2.0.json"`);
    expect(html).toContain(`href="${GITHUB}/blob/main/rubrics/mycel-1.3.1.json"`);
    // Strikes are in the rubric text but not built.
    expect(text(page)).not.toMatch(/strike/i);
  });
});

describe("the site header", () => {
  it("links the rules page", () => {
    expect(renderToStaticMarkup(<SiteHeader />)).toContain('href="/rules"');
  });
});
