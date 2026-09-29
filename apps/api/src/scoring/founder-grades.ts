import { creditedScore, ScoreFlag } from "@hyphae/core";
import { z } from "zod";
import { type EvalCase, EvalCasesSchema } from "./eval.js";

// Cisco's range rule (2026-09-28): raw and credited each land within the founder target ±5.
export const TARGET_TOLERANCE = 5;

type Range = [number, number];
const score = z.number().int().min(0).max(100);

const FounderLabelsSchema = z
  .object({
    reason: z.string(),
    targetScore: score.optional(),
    targetScoreRange: z
      .tuple([score, score])
      .refine(([min, max]) => min <= max)
      .optional(),
  })
  .transform((l, ctx) => {
    if (l.targetScore !== undefined && !l.targetScoreRange) {
      return { reason: l.reason, target: [l.targetScore, l.targetScore] as Range, isRange: false };
    }
    if (l.targetScoreRange && l.targetScore === undefined) {
      return { reason: l.reason, target: l.targetScoreRange as Range, isRange: true };
    }
    ctx.addIssue({ code: "custom", message: "a case needs exactly one founder target" });
    return z.NEVER;
  });

const ReviewSchema = z.object({
  cases: z.array(
    z.object({
      id: z.string(),
      task: z.unknown().optional(),
      contribution: z.unknown(),
      expectedPolicy: z.object({
        requiredFlags: z.array(ScoreFlag),
        forbiddenFlags: z.array(ScoreFlag),
        expectedAiSignals: z.array(z.string()).default([]),
      }),
      founderLabels: FounderLabelsSchema,
    }),
  ),
});

const around = (t: number): Range => [
  Math.max(0, t - TARGET_TOLERANCE),
  Math.min(100, t + TARGET_TOLERANCE),
];

// Converts the founder-scored synthetic review into harness cases. The credited target is the
// production credit rule applied to the founder's raw target and required flags; the expected AI
// signals stand in for aiSlop.patterns, so three or more take the strong cap. A founder range
// (case 12) is kept as given.
export function founderGrades(review: unknown): EvalCase[] {
  const cases = ReviewSchema.parse(review).cases.map((c) => {
    const { requiredFlags, forbiddenFlags, expectedAiSignals } = c.expectedPolicy;
    const { reason, target, isRange } = c.founderLabels;
    const credit = (raw: number) =>
      creditedScore({
        score: raw,
        rubricHits: [],
        flags: requiredFlags,
        aiSlop: { patterns: expectedAiSignals, templateRhythm: false },
        reasoning: "",
      });
    const credited: Range = [credit(target[0]), credit(target[1])];
    return {
      id: c.id,
      task: c.task,
      contribution: c.contribution,
      expected: {
        reason,
        target: { raw: target, credited },
        raw: isRange ? target : around(target[0]),
        // A credited score is 0 or at least 60, so a credited target of 0 is exact.
        credited: isRange || credited[0] === 0 ? credited : around(credited[0]),
        requiredFlags,
        forbiddenFlags,
      },
    };
  });
  return EvalCasesSchema.parse(cases);
}
