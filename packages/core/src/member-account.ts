import { z } from "zod";

const common = {
  community: z.strictObject({ mint: z.string().regex(/^[A-Za-z0-9]{1,64}$/), name: z.string() }),
  as_of: z.iso.datetime(),
};
const wallet = z
  .strictObject({
    address: z
      .string()
      .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
      .nullable(),
    status: z.enum(["none", "paste", "signature"]),
  })
  .refine((value) => (value.address === null) === (value.status === "none"));

// The signed-in member's own pass of the rules test that the community's current rules require;
// null when those rules have no test. Added inside v1, so an older api omits it.
const rulesTest = z
  .strictObject({ passed: z.boolean(), passed_at: z.iso.datetime().nullable() })
  .refine((value) => value.passed === (value.passed_at !== null));

export const MemberAccountSchema = z.discriminatedUnion("state", [
  z.strictObject({ ...common, state: z.literal("telegram_required") }),
  z.strictObject({ ...common, state: z.literal("join_required") }),
  z.strictObject({ ...common, state: z.literal("member_not_registered") }),
  z.strictObject({
    ...common,
    state: z.literal("member"),
    wallet,
    rules_test: rulesTest.nullable().optional(),
  }),
]);

export type MemberAccount = z.infer<typeof MemberAccountSchema>;
