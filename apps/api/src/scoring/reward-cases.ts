import { z } from "zod";

// Fixed replies for comparing reward prompt versions (scripts/eval-reward-prompt.ts).
const Task = z.object({
  targetUrl: z.string(),
  targetAuthor: z.string(),
  targetText: z.string(),
  brief: z.string(),
});

export const Cases = z.object({
  tasks: z.record(z.string(), Task),
  cases: z.array(
    z.object({
      id: z.string(),
      task: z.string(),
      kind: z.enum(["reply", "quote", "post", "text"]),
      text: z.string(),
      // pass: must be credited (60 or more). zero: must be credited 0. any: shown, not judged.
      expect: z.enum(["pass", "zero", "any"]),
    }),
  ),
});

export const judge = (expect: "pass" | "zero" | "any", credited: number): boolean =>
  expect === "any" || (expect === "pass" ? credited >= 60 : credited === 0);

// A count that is not a positive whole number would skip every case and still look like success.
export function parseRuns(value: string): number {
  const runs = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(runs) || runs < 1) {
    throw new Error(`--runs must be a positive whole number, got "${value}"`);
  }
  return runs;
}

export const exitCode = (r: { misses: number; errors: number }): 0 | 1 =>
  r.misses === 0 && r.errors === 0 ? 0 : 1;
