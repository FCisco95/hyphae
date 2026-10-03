const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function privateWalletLink(origin: string, token: string): string | undefined {
  if (!TOKEN.test(token)) return undefined;
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && url.origin === origin) return `${origin}/link#${token}`;
  } catch {
    /* Invalid origins cannot become private-link destinations. */
  }
  return undefined;
}

export async function copyWalletLink(
  link: string,
  clipboard?: { writeText(text: string): Promise<void> },
): Promise<boolean> {
  try {
    if (!clipboard) return false;
    await clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}
