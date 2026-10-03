import { z } from "zod";

function publicHttps(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      !url.search &&
      /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)
    )
      return url;
  } catch {
    /* Invalid owner configuration fails closed. */
  }
  return undefined;
}

const Presentation = z
  .object({
    pilot: z.boolean().optional(),
    telegramInvite: z
      .url()
      .refine((value) => {
        const url = publicHttps(value);
        return (
          !!url &&
          url.hostname === "t.me" &&
          /^(?:\/\+[A-Za-z0-9_-]+|\/joinchat\/[A-Za-z0-9_-]+|\/[A-Za-z0-9_]{5,32})$/.test(
            url.pathname,
          )
        );
      })
      .optional(),
    supportUrl: z
      .url()
      .refine((value) => !!publicHttps(value))
      .optional(),
  })
  .strict();

export type CommunityPresentation = z.infer<typeof Presentation>;

// No owner-verified invite/support/status values have been supplied for production.
const PRESENTATIONS: Readonly<Record<string, unknown>> = {};

export function communityPresentation(
  mint: string,
  entries: Readonly<Record<string, unknown>> = PRESENTATIONS,
): CommunityPresentation | undefined {
  if (!Object.hasOwn(entries, mint)) return undefined;
  const parsed = Presentation.safeParse(entries[mint]);
  return parsed.success ? parsed.data : undefined;
}
