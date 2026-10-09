import { describe, expect, it } from "vitest";
import { memberLoginConfig } from "./member-login-config.js";
import { privyDevelopmentConfig } from "./privy-development-config.js";

describe("isolated Privy development test", () => {
  const values = { appId: "fixture-dev", localPreview: "on" };
  it("permits only the owned loopback preview host", () => {
    expect(privyDevelopmentConfig(values, "127.0.0.1:3010")).toEqual({ appId: "fixture-dev" });
    for (const host of [
      "localhost:3010",
      "127.0.0.1:3000",
      "fixture.test",
      "preview.vercel.app",
      "127.0.0.1:3010.attacker.test",
    ])
      expect(privyDevelopmentConfig(values, host)).toBeNull();
  });
  it("refuses deployment, absent app ID and absent explicit preview mode", () => {
    for (const config of [
      {},
      { appId: "fixture-dev" },
      { localPreview: "on" },
      { ...values, appId: " " },
      { ...values, vercel: "1" },
      { ...values, vercel: "0" },
    ])
      expect(privyDevelopmentConfig(config, "127.0.0.1:3010")).toBeNull();
  });
  it("does not enable private member login with a development app", () => {
    expect(
      memberLoginConfig(
        { appId: "fixture-dev", enabled: "on", cookieDomain: "127.0.0.1:3010" },
        "127.0.0.1:3010",
      ),
    ).toBeNull();
  });
});
