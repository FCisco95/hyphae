import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type MemberIdentityProvider, privyIdentity } from "./privy.js";

let provider: MemberIdentityProvider;
let privateKey: CryptoKey;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
beforeAll(async () => {
  const keys = await generateKeyPair("ES256");
  privateKey = keys.privateKey;
  provider = privyIdentity({
    appId: "hyphae-fixture",
    appSecret: "fixture-only",
    verificationKey: await exportSPKI(keys.publicKey),
  });
});
async function token(
  overrides: { issuer?: string; audience?: string; subject?: string; expiry?: string } = {},
) {
  return new SignJWT({ sid: "fixture" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer(overrides.issuer ?? "privy.io")
    .setAudience(overrides.audience ?? "hyphae-fixture")
    .setSubject(overrides.subject ?? "did:privy:fixture")
    .setIssuedAt()
    .setExpirationTime(overrides.expiry ?? "1h")
    .sign(privateKey);
}
describe("real app-bound Privy verifier", () => {
  it("uses a fresh server user read without transport logging even with debug env", async () => {
    vi.stubEnv("PRIVY_API_LOG", "debug");
    const logs = (["debug", "info", "warn", "error", "log"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    const requests: Request[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return Response.json({ id: "did:privy:fixture", linked_accounts: [] });
    });
    const keys = await generateKeyPair("ES256");
    const freshProvider = privyIdentity({
      appId: "hyphae-fixture",
      appSecret: "fixture-only",
      verificationKey: await exportSPKI(keys.publicKey),
    });
    const signal = new AbortController().signal;
    await expect(freshProvider.currentUser("did:privy:fixture", signal)).resolves.toEqual({
      id: "did:privy:fixture",
      linked_accounts: [],
    });
    await freshProvider.currentUser("did:privy:fixture", signal);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.method).toBe("GET");
    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/v1/users/did:privy:fixture");
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });
  it("verifies an own-app token", async () => {
    expect(await provider.verify(await token())).toBe("did:privy:fixture");
  });
  it.each([
    { issuer: "attacker.test" },
    { audience: "other-app" },
    { expiry: "-1s" },
    { subject: "arbitrary-user" },
  ])("rejects invalid claims %o", async (claims) => {
    await expect(provider.verify(await token(claims))).rejects.toThrow();
  });
  it("rejects forged signatures", async () => {
    const other = await generateKeyPair("ES256");
    const forged = await new SignJWT({ sid: "fixture" })
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .setSubject("did:privy:fixture")
      .setIssuer("privy.io")
      .setAudience("hyphae-fixture")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(other.privateKey);
    await expect(provider.verify(forged)).rejects.toThrow();
  });
  it("rejects an algorithm substitution", async () => {
    const wrong = await new SignJWT({ sid: "fixture" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("did:privy:fixture")
      .setIssuer("privy.io")
      .setAudience("hyphae-fixture")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new Uint8Array(32));
    await expect(provider.verify(wrong)).rejects.toThrow();
  });
  it("rejects missing required expiry", async () => {
    const missing = await new SignJWT({ sid: "fixture" })
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .setSubject("did:privy:fixture")
      .setIssuer("privy.io")
      .setAudience("hyphae-fixture")
      .setIssuedAt()
      .sign(privateKey);
    await expect(provider.verify(missing)).rejects.toThrow();
  });
});
