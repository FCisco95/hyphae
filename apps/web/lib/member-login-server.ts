import { headers } from "next/headers.js";
import { memberLoginConfig } from "./member-login-config.js";

export async function readMemberLoginConfig() {
  return memberLoginConfig(
    {
      appId: process.env.PRIVY_APP_ID,
      cookieDomain: process.env.PRIVY_LOGIN_HOST,
      enabled: process.env.PRIVY_LOGIN_ENABLED,
    },
    (await headers()).get("host") ?? "",
  );
}
