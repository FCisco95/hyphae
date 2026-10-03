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

export interface CommunityPresentation {
  pilot?: boolean;
  telegramInvite?: string;
  supportUrl?: string;
}

function parsePresentation(value: unknown): CommunityPresentation | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["pilot", "telegramInvite", "supportUrl"].includes(key)))
    return undefined;
  const { pilot, telegramInvite, supportUrl } = record;
  if (pilot !== undefined && typeof pilot !== "boolean") return undefined;
  if (telegramInvite !== undefined) {
    if (typeof telegramInvite !== "string") return undefined;
    const url = publicHttps(telegramInvite);
    if (
      url?.hostname !== "t.me" ||
      !/^(?:\/\+[A-Za-z0-9_-]+|\/joinchat\/[A-Za-z0-9_-]+|\/[A-Za-z0-9_]{5,32})$/.test(url.pathname)
    )
      return undefined;
  }
  if (supportUrl !== undefined && (typeof supportUrl !== "string" || !publicHttps(supportUrl)))
    return undefined;
  return {
    ...(typeof pilot === "boolean" ? { pilot } : {}),
    ...(typeof telegramInvite === "string" ? { telegramInvite } : {}),
    ...(typeof supportUrl === "string" ? { supportUrl } : {}),
  };
}

// No owner-verified invite/support/status values have been supplied for production.
const PRESENTATIONS: Readonly<Record<string, unknown>> = {};

export function communityPresentation(
  mint: string,
  entries: Readonly<Record<string, unknown>> = PRESENTATIONS,
): CommunityPresentation | undefined {
  if (!Object.hasOwn(entries, mint)) return undefined;
  return parsePresentation(entries[mint]);
}
