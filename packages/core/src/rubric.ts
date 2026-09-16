import { z } from "zod";

export const RubricSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  community: z.string().min(1),
  guidelines: z.string().min(20),
  criteria: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z_]+$/),
        label: z.string(),
        weight: z.number().min(0).max(1),
        description: z.string(),
      }),
    )
    .min(1),
  timing: z.object({
    // Minutes after a raid opens: full credit until fullUntil, linear to zero at zeroAt.
    fullUntil: z.number().int().positive(),
    zeroAt: z.number().int().positive(),
  }),
  stakeWeight: z.enum(["none", "sqrt"]),
  minHoldUnits: z.string().regex(/^\d+$/), // base units as decimal string
  weeklyCapLamports: z.string().regex(/^\d+$/).optional(),
  proposalAcceptThreshold: z.number().int().min(0).max(100),
});
export type Rubric = z.infer<typeof RubricSchema>;
