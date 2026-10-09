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

export const MemberAccountSchema = z.discriminatedUnion("state", [
  z.strictObject({ ...common, state: z.literal("telegram_required") }),
  z.strictObject({ ...common, state: z.literal("join_required") }),
  z.strictObject({ ...common, state: z.literal("member_not_registered") }),
  z.strictObject({ ...common, state: z.literal("member"), wallet }),
]);

export type MemberAccount = z.infer<typeof MemberAccountSchema>;
