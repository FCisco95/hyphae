import { PrivyClient, verifyAccessToken } from "@privy-io/node";

export interface MemberIdentityProvider {
  verify(token: string): Promise<string>;
  currentUser(subject: string, signal: AbortSignal): Promise<unknown>;
}

export function privyIdentity({
  appId,
  appSecret,
  verificationKey,
}: {
  appId: string;
  appSecret: string;
  verificationKey: string;
}): MemberIdentityProvider {
  const client = new PrivyClient({
    appId,
    appSecret,
    timeout: 5000,
    maxRetries: 0,
    logLevel: "off",
  });
  return {
    async verify(token) {
      const claims = await verifyAccessToken({
        access_token: token,
        app_id: appId,
        verification_key: verificationKey,
      });
      if (!/^did:privy:[A-Za-z0-9_-]+$/.test(claims.user_id)) throw new Error("invalid_auth");
      return claims.user_id;
    },
    currentUser: (subject, signal) => client.users()._get(subject, { signal, maxRetries: 0 }),
  };
}
