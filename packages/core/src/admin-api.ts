import { z } from "zod";

const pausedAt = z.iso.datetime().nullable();

export const AdminCommunitySchema = z.strictObject({
  state: z.literal("admin"),
  community: z.strictObject({ mint: z.string().regex(/^[A-Za-z0-9]{1,64}$/), name: z.string() }),
  intake: z
    .strictObject({ paused: z.boolean(), paused_at: pausedAt })
    .refine((value) => value.paused === (value.paused_at !== null)),
  as_of: z.iso.datetime(),
});

// The observed value prevents a stale page from overwriting a newer operator action.
export const AdminIntakeUpdateSchema = z.strictObject({
  paused: z.boolean(),
  expected_paused_at: pausedAt,
});

export type AdminCommunity = z.infer<typeof AdminCommunitySchema>;
export type AdminIntakeUpdate = z.infer<typeof AdminIntakeUpdateSchema>;
