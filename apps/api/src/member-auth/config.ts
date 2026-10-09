import { createPublicKey } from "node:crypto";

export function memberAuthConfig(values: {
  PRIVY_APP_ID?: string | undefined;
  PRIVY_APP_SECRET?: string | undefined;
  PRIVY_VERIFICATION_KEY?: string | undefined;
}): { appId: string; appSecret: string; verificationKey: string } | null {
  const {
    PRIVY_APP_ID: appId,
    PRIVY_APP_SECRET: appSecret,
    PRIVY_VERIFICATION_KEY: verificationKey,
  } = values;
  if (
    !appId?.trim() ||
    !appSecret?.trim() ||
    !verificationKey?.startsWith("-----BEGIN PUBLIC KEY-----")
  )
    return null;
  try {
    const key = createPublicKey(verificationKey);
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1")
      return null;
  } catch {
    return null;
  }
  return { appId, appSecret, verificationKey };
}
