export function privyDevelopmentConfig(
  values: {
    appId?: string | undefined;
    localPreview?: string | undefined;
    vercel?: string | undefined;
  },
  host: string,
): { appId: string } | null {
  if (
    values.localPreview !== "on" ||
    values.vercel ||
    host !== "127.0.0.1:3010" ||
    !values.appId?.trim()
  )
    return null;
  return { appId: values.appId.trim() };
}
