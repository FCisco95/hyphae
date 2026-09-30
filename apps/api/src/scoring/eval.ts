import { creditedScore, ScoreFlag, type ScoreOutput } from "@hyphae/core";
import { z } from "zod";

const text = z.string().refine((value) => value.trim().length > 0, "text must not be blank");
const range = z
  .tuple([z.number().int().min(0).max(100), z.number().int().min(0).max(100)])
  .refine(([min, max]) => min <= max, "range minimum must not exceed maximum");

const ExpectedSchema = z
  .strictObject({
    founderGrade: z.number().min(0).max(5).optional(),
    // The founder's own score, for the absolute error; a point target is [t, t].
    target: z.strictObject({ raw: range, credited: range }).optional(),
    reason: text,
    raw: range,
    credited: range,
    requiredFlags: z.array(ScoreFlag).default([]),
    forbiddenFlags: z.array(ScoreFlag).default([]),
  })
  .refine(
    (e) => !e.requiredFlags.some((flag) => e.forbiddenFlags.includes(flag)),
    "a flag cannot be both required and forbidden",
  );

export const EvalCasesSchema = z
  .array(
    z.strictObject({
      id: text,
      task: z
        .strictObject({
          targetUrl: z.url(),
          targetText: text,
          targetAuthor: text,
          brief: z.string(),
        })
        .optional(),
      contribution: z.strictObject({
        kind: z.enum(["reply", "quote", "post", "text"]),
        url: z.url().optional(),
        text,
        authorHandle: text.optional(),
      }),
      expected: ExpectedSchema,
    }),
  )
  .min(1)
  .refine((cases) => new Set(cases.map((c) => c.id)).size === cases.length, "duplicate case id");

export type EvalCase = z.infer<typeof EvalCasesSchema>[number];

const distance = (score: number, [min, max]: readonly [number, number]) =>
  score < min ? min - score : score > max ? score - max : 0;

// Cisco's ruling 1 (2026-09-30): low_effort is a hard zero. Only the eval applies it so far;
// creditedScore in packages/core changes with a rubric version, not with an offline comparison.
const evalCredited = (output: ScoreOutput): number =>
  output.flags.includes("low_effort") ? 0 : creditedScore(output);

export function compareScore(output: ScoreOutput, expected: EvalCase["expected"]) {
  const raw = output.score;
  const credited = evalCredited(output);
  const failures: string[] = [];
  for (const [name, score] of [
    ["raw", raw],
    ["credited", credited],
  ] as const) {
    const [min, max] = expected[name];
    if (score < min || score > max) failures.push(`${name} ${score} outside ${min}-${max}`);
  }
  for (const flag of expected.requiredFlags) {
    if (!output.flags.includes(flag)) failures.push(`missing flag ${flag}`);
  }
  for (const flag of expected.forbiddenFlags) {
    if (output.flags.includes(flag)) failures.push(`forbidden flag ${flag}`);
  }
  const error = expected.target && {
    raw: distance(raw, expected.target.raw),
    credited: distance(credited, expected.target.credited),
  };
  return { raw, credited, passed: failures.length === 0, failures, ...(error && { error }) };
}
