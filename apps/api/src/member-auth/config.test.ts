import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { memberAuthConfig } from "./config.js";

const key = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
}).publicKey;
const config = {
  PRIVY_APP_ID: "fixture-app",
  PRIVY_APP_SECRET: "fixture-secret",
  PRIVY_VERIFICATION_KEY: key,
};
describe("optional member authentication", () => {
  it("accepts complete configuration with an ES256 public key", () => {
    expect(memberAuthConfig(config)).toEqual({
      appId: "fixture-app",
      appSecret: "fixture-secret",
      verificationKey: key,
    });
  });
  it.each([
    {},
    { PRIVY_APP_ID: "fixture-app" },
    { ...config, PRIVY_APP_SECRET: "" },
    { ...config, PRIVY_VERIFICATION_KEY: "invalid" },
  ])("disables incomplete or malformed configuration without throwing %o", (value) => {
    expect(memberAuthConfig(value)).toBeNull();
  });
  it("rejects a different curve", () => {
    const wrongKey = generateKeyPairSync("ec", {
      namedCurve: "secp384r1",
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    }).publicKey;
    expect(memberAuthConfig({ ...config, PRIVY_VERIFICATION_KEY: wrongKey })).toBeNull();
  });
});
