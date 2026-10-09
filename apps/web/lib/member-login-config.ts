export function memberLoginConfig(
  values: {
    appId?: string | undefined;
    enabled?: string | undefined;
    cookieDomain?: string | undefined;
  },
  host: string,
): { appId: string } | null {
  const { appId, enabled, cookieDomain } = values;
  if (
    enabled !== "on" ||
    !appId?.trim() ||
    !cookieDomain ||
    !/^[a-z0-9]+(?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9]+(?:[-a-z0-9]*[a-z0-9])?)+$/.test(cookieDomain)
  )
    return null;
  if (host.toLowerCase() !== cookieDomain) return null;
  return { appId };
}
