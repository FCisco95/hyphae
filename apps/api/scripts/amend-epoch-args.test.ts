import { describe, expect, it } from "vitest";
import { parseAmendArgs } from "./amend-epoch-args.js";

const MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
const base = [
  MINT,
  "--epoch",
  "2",
  "--prompt",
  "reward-eval/2",
  "--effective-at",
  "2026-10-07T18:00:00Z",
  "--actor",
  "Cisco (founder)",
  "--reason",
  " We are in the pilot testing phase. ",
];

describe("parseAmendArgs", () => {
  it("reads the mint, epoch, prompt, UTC effective time, actor and trimmed reason", () => {
    expect(parseAmendArgs(base)).toEqual({
      mint: MINT,
      plan: false,
      input: {
        epochIndex: 2,
        promptVersion: "reward-eval/2",
        effectiveAt: new Date("2026-10-07T18:00:00.000Z"),
        actor: "Cisco (founder)",
        reason: "We are in the pilot testing phase.",
      },
    });
  });

  it("--plan records nothing", () => {
    expect(parseAmendArgs([...base, "--plan"]).plan).toBe(true);
  });

  it("refuses an effective time without a zone, which the host would read in local time", () => {
    const local = base.map((a) => (a === "2026-10-07T18:00:00Z" ? "2026-10-07T18:00:00" : a));
    expect(() => parseAmendArgs(local)).toThrow(/Z or an explicit UTC offset/);
  });

  it("refuses a missing or non-numeric epoch, a missing prompt, actor or reason", () => {
    const without = (flag: string) => {
      const i = base.indexOf(flag);
      return [...base.slice(0, i), ...base.slice(i + 2)];
    };
    for (const flag of ["--epoch", "--prompt", "--effective-at", "--actor", "--reason"]) {
      expect(() => parseAmendArgs(without(flag))).toThrow(/usage/);
    }
    expect(() => parseAmendArgs(base.map((a) => (a === "2" ? "2x" : a)))).toThrow(/usage/);
    expect(() => parseAmendArgs(base.map((a) => (a === "2" ? "0" : a)))).toThrow(/usage/);
    expect(() => parseAmendArgs(base.map((a) => (a === "Cisco (founder)" ? " " : a)))).toThrow(
      /usage/,
    );
    expect(() => parseAmendArgs(base.slice(1))).toThrow(/usage/);
  });
});
