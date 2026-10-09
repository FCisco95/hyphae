import { z } from "zod";

// A linked public post, never an arbitrary URL or provider-supplied HTML.
export function publicXPost(value: string | null): { url: string; handle: string } | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const match = /^\/([A-Za-z0-9_]{1,15})\/status\/([0-9]{1,19})\/?$/.exec(url.pathname);
    if (
      url.protocol !== "https:" ||
      !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !match
    )
      return null;
    return { url: `https://x.com/${match[1]}/status/${match[2]}`, handle: match[1] as string };
  } catch {
    return null;
  }
}

const timestamp = z.iso.datetime({ precision: null });
export const PublicRaidSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(["open", "scheduled", "closed", "cancelled"]),
  opens_at: timestamp,
  closes_at: timestamp,
  brief: z.string().max(2000),
  post: z
    .strictObject({
      url: z.string().refine((value) => publicXPost(value)?.url === value),
      handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/),
      text: z.string().max(1500).nullable(),
    })
    .nullable(),
});
export const PublicRaidsSchema = z.strictObject({
  community: z.strictObject({ mint: z.string().regex(/^[A-Za-z0-9]{1,64}$/) }),
  reward_intake: z.enum(["open", "paused"]),
  raids: z.array(PublicRaidSchema).max(26),
  as_of: timestamp,
});
export type PublicRaid = z.infer<typeof PublicRaidSchema>;
export type PublicRaids = z.infer<typeof PublicRaidsSchema>;
