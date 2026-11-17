import { describe, expect, it, vi } from "vitest";
import { createHyphaeOperatorClient, HyphaeAdminError } from "../src/index.js";

const baseUrl = "https://api.example/admin/v1";
const TOKEN = `hop_${"A".repeat(43)}`;
const WALLET = "CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2";
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) });
const overview = (mint = "CommunityA") => ({
  community: { mint, name: "Community", chain_address: WALLET, network: "solana:mainnet" },
  hold: { held: true },
  policy: { present: false },
  epochs: [
    {
      index: 8,
      status: "open",
      closes_at: "2026-11-21T00:00:00.000Z",
      published: false,
      decision: null,
      gate: { status: "not_evaluated", blockers: [], payable: 0, held: 0, not_payable: 0 },
    },
  ],
  top_up: { status: "held" },
  raids: { by_state: [], active: [], deliveries: [] },
  jobs: { status: "unavailable" },
  as_of: "2026-11-17T12:00:00.000Z",
});
const make = (response: () => Response, token: string | null = TOKEN) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => response());
  const getSessionToken = vi.fn(async () => token);
  return {
    client: createHyphaeOperatorClient({ baseUrl, fetch, getSessionToken }),
    fetch,
    getSessionToken,
  };
};
async function code(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HyphaeAdminError);
    return (error as HyphaeAdminError).code;
  }
  throw new Error("expected a rejection");
}

describe("operator client", () => {
  it("signs in without a token, then reads with the session token and no ambient credentials", async () => {
    const challenge = {
      challenge_id: "11111111-2222-4333-8444-555555555555",
      message: "hyphae.test asks you to sign in",
      expires_at: "2026-11-17T12:05:00.000Z",
    };
    const created = {
      wallet: WALLET,
      mint: "CommunityA",
      expires_at: "2026-11-17T16:00:00.000Z",
      token: TOKEN,
    };
    const replies = [json(challenge), json(created), json(overview())];
    const { client, fetch, getSessionToken } = make(() => replies.shift() as Response);
    expect(await client.requestChallenge({ mint: "CommunityA", wallet: WALLET })).toEqual(
      challenge,
    );
    expect(
      await client.createSession({
        challengeId: challenge.challenge_id,
        signature: "1".repeat(88),
      }),
    ).toEqual(created);
    expect(getSessionToken).not.toHaveBeenCalled();
    expect((await client.overview("CommunityA")).top_up).toEqual({ status: "held" });
    expect(getSessionToken).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `${baseUrl}/operator/challenge`,
      `${baseUrl}/operator/session`,
      `${baseUrl}/operator/communities/CommunityA/overview`,
    ]);
    const [first, second, third] = fetch.mock.calls.map(([, init]) => init);
    expect(first).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
    expect((first?.headers ?? {}) as Record<string, string>).not.toHaveProperty("authorization");
    expect(JSON.parse(second?.body as string)).toEqual({
      challenge_id: challenge.challenge_id,
      signature: "1".repeat(88),
    });
    expect(third?.headers).toMatchObject({ authorization: `Bearer ${TOKEN}` });
  });

  it("reports a switched-off surface as disabled, distinct from not found", async () => {
    expect(await code(make(() => json({ error: "disabled" }, 404)).client.status())).toBe(
      "disabled",
    );
    expect(await code(make(() => json({ error: "not_found" }, 404)).client.status())).toBe(
      "not_found",
    );
  });

  it("refuses to call without a well-formed token, and bad input before any request", async () => {
    const signedOut = make(() => json(overview()), null);
    expect(await code(signedOut.client.overview("CommunityA"))).toBe("unauthorized");
    const malformed = make(() => json(overview()), "privy.jwt.token");
    expect(await code(malformed.client.session())).toBe("unauthorized");
    expect(signedOut.fetch).not.toHaveBeenCalled();
    expect(malformed.fetch).not.toHaveBeenCalled();
    const { client, fetch } = make(() => json(overview()));
    expect(() => client.requestChallenge({ mint: "Bad/Mint", wallet: WALLET })).toThrow(
      HyphaeAdminError,
    );
    expect(() => client.createSession({ challengeId: "nope", signature: "x" })).toThrow(
      HyphaeAdminError,
    );
    await expect(client.overview("Bad/Mint")).rejects.toThrow(HyphaeAdminError);
    await expect(client.payable("CommunityA", -1)).rejects.toThrow(HyphaeAdminError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects another community's overview, another epoch and unexpected fields", async () => {
    expect(await code(make(() => json(overview("Other"))).client.overview("CommunityA"))).toBe(
      "identity_mismatch",
    );
    const payable = { epoch_index: 3, gate_status: "ready", wallets: [WALLET] };
    expect(await code(make(() => json(payable)).client.payable("CommunityA", 4))).toBe(
      "identity_mismatch",
    );
    expect(
      await code(make(() => json({ ...payable, handles: ["x"] })).client.payable("CommunityA", 3)),
    ).toBe("schema_mismatch");
    expect(await make(() => json(payable)).client.payable("CommunityA", 3)).toEqual(payable);
  });

  it("maps errors and bounds the body", async () => {
    expect(await code(make(() => json({ error: "forbidden" }, 403)).client.session())).toBe(
      "forbidden",
    );
    const limited = make(() => json({ error: "unavailable" }, 429, { "retry-after": "10" }));
    try {
      await limited.client.session();
    } catch (error) {
      expect(error).toMatchObject({ code: "rate_limited", retryAfterSeconds: 10 });
    }
    const big = make(() => new Response("x".repeat(70 * 1024)));
    expect(await code(big.client.session())).toBe("response_too_large");
    expect(await code(make(() => new Response("{")).client.session())).toBe("invalid_json");
  });

  it("validates its configuration", () => {
    const ok = { baseUrl, getSessionToken: async () => TOKEN };
    expect(() => createHyphaeOperatorClient(ok)).not.toThrow();
    for (const url of [
      "http://remote.test/admin/v1",
      "https://api.test/v1",
      "https://u:p@api.test/admin/v1",
    ])
      expect(() => createHyphaeOperatorClient({ ...ok, baseUrl: url })).toThrow(HyphaeAdminError);
    expect(() => createHyphaeOperatorClient({ ...ok, timeoutMs: 0 })).toThrow(HyphaeAdminError);
  });
});
