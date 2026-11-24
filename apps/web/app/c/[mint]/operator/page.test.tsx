import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { community } from "../../../../components/fixtures.js";
import { readCommunity } from "../../../../lib/reads.js";
import OperatorPage from "./page.js";

const TOKEN = `hop_${"A".repeat(43)}`;
const WALLET = "CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2";
let cookie: string | undefined;
vi.mock("../../../../lib/reads.js", () => ({ readCommunity: vi.fn() }));
vi.mock("next/headers.js", () => ({
  cookies: async () => ({ get: () => (cookie === undefined ? undefined : { value: cookie }) }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation.js", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("../../../../components/operator-client.js", () => ({
  OperatorSignIn: () => <p>Fixture sign-in</p>,
  OperatorSignOut: () => <button type="button">Sign out</button>,
  OperatorPayable: ({ index }: { index: number }) => <p>Fixture payable {index}</p>,
}));
vi.mock("../../../../components/operator-publish.js", () => ({
  OperatorPublish: ({ wallet }: { wallet: string }) => <p>Fixture publish {wallet}</p>,
  OperatorInit: ({ mint }: { mint: string }) => <p>Fixture init {mint}</p>,
}));

const params = { params: Promise.resolve({ mint: community.mint }) };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const overview = {
  community: {
    mint: community.mint,
    name: community.name,
    chain_address: WALLET,
    network: "solana:mainnet",
  },
  hold: { held: true },
  policy: { present: true },
  epochs: [
    {
      index: 7,
      status: "closed",
      closes_at: "2026-11-14T00:00:00.000Z",
      published: false,
      decision: "rolled_over",
      gate: { status: "ready", blockers: [], payable: 3, held: 0, not_payable: 1 },
    },
    {
      index: 1,
      status: "closed",
      closes_at: "2026-10-01T00:00:00.000Z",
      published: false,
      decision: null,
      gate: { status: "blocked", blockers: ["legacy_epoch"], payable: 0, held: 0, not_payable: 0 },
    },
  ],
  top_up: { status: "ok", epoch_index: 7, outcome: "rolled_over", lamports: "600000000" },
  raids: { by_state: [{ state: "active", count: 1 }], active: [], deliveries: [] },
  jobs: { status: "available", groups: [{ name: "payout-settle", state: "failed", count: 2 }] },
  as_of: "2026-11-17T12:00:00.000Z",
};
const session = { wallet: WALLET, mint: community.mint, expires_at: "2026-11-17T16:00:00.000Z" };
function api(routes: Record<string, () => Response>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
    const path = String(url).replace("https://api.test/admin/v1/operator", "");
    const reply = routes[path];
    if (!reply) throw new Error(`unexpected ${path}`);
    return reply();
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  cookie = undefined;
  vi.stubEnv("HYPHAE_API_URL", "https://api.test/");
  vi.mocked(readCommunity).mockResolvedValue({ ok: true, data: community });
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("operator page", () => {
  it("says it is turned off when the API answers disabled, and offers no sign-in", async () => {
    cookie = TOKEN;
    const fetch = api({ "/status": () => json({ error: "disabled" }, 404) });
    const html = renderToStaticMarkup(await OperatorPage(params));
    expect(html).toContain("The operator page is turned off");
    expect(html).not.toContain("Fixture sign-in");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("says turned off for an API that predates the operator routes", async () => {
    api({ "/status": () => json({ error: "not_found" }, 404) });
    const html = renderToStaticMarkup(await OperatorPage(params));
    expect(html).toContain("The operator page is turned off");
    expect(html).not.toContain("Fixture sign-in");
  });

  it("says unavailable without an API URL or on an outage", async () => {
    vi.stubEnv("HYPHAE_API_URL", "");
    expect(renderToStaticMarkup(await OperatorPage(params))).toContain("unavailable right now");
    vi.stubEnv("HYPHAE_API_URL", "https://api.test/");
    api({ "/status": () => json({ error: "unavailable" }, 503) });
    expect(renderToStaticMarkup(await OperatorPage(params))).toContain("unavailable right now");
  });

  it("asks to sign in without a session, and after an expired one", async () => {
    api({ "/status": () => json({ state: "enabled" }) });
    expect(renderToStaticMarkup(await OperatorPage(params))).toContain("Fixture sign-in");
    cookie = TOKEN;
    api({
      "/status": () => json({ state: "enabled" }),
      "/session": () => json({ error: "unauthorized" }, 401),
    });
    const html = renderToStaticMarkup(await OperatorPage(params));
    expect(html).toContain("Your session ended");
    expect(html).toContain("Fixture sign-in");
  });

  it("refuses a wallet that is no longer the on-chain admin", async () => {
    cookie = TOKEN;
    api({
      "/status": () => json({ state: "enabled" }),
      "/session": () => json({ error: "forbidden" }, 403),
    });
    expect(renderToStaticMarkup(await OperatorPage(params))).toContain(
      "not the community&#x27;s on-chain admin",
    );
  });

  it("shows the hold, the top-up, the gate per epoch, raids and failed jobs", async () => {
    cookie = TOKEN;
    const fetch = api({
      "/status": () => json({ state: "enabled" }),
      "/session": () => json(session),
      [`/communities/${community.mint}/overview`]: () => json(overview),
      [`/communities/${community.mint}/publish/status`]: () =>
        json({ state: "enabled", build: null }),
    });
    const html = renderToStaticMarkup(await OperatorPage(params));
    expect(html).toContain("Payouts are on hold");
    // Held: the publish panel says so and offers no publish.
    expect(html).toContain("nothing can be published");
    expect(html).not.toContain("Fixture publish");
    expect(html).toContain("Top-up needed: 0.6 SOL (600000000 lamports)");
    expect(html).toContain("Epoch 7");
    expect(html).toContain("3 payable");
    expect(html).toContain("Fixture payable 7");
    expect(html).toContain("legacy epoch");
    expect(html).toContain("payout-settle");
    expect(html).toContain("is-failed");
    expect(html).not.toContain(TOKEN);
    const auth = fetch.mock.calls
      .filter(([url]) => !String(url).endsWith("/operator/status"))
      .map(([, init]) => ((init?.headers ?? {}) as Record<string, string>).authorization);
    expect(auth).toEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`, `Bearer ${TOKEN}`]);
  });

  it.each([
    ["disabled", json({ error: "disabled" }, 404), "Publishing from this page is turned off"],
    [
      "absent (an older API)",
      json({ error: "not_found" }, 404),
      "Publishing from this page is turned off",
    ],
    ["down", json({ error: "unavailable" }, 503), "Publishing is unavailable right now"],
  ])("says so when publish is %s, and offers no publish", async (_what, reply, text) => {
    cookie = TOKEN;
    api({
      "/status": () => json({ state: "enabled" }),
      "/session": () => json(session),
      [`/communities/${community.mint}/overview`]: () =>
        json({ ...overview, hold: { held: false } }),
      [`/communities/${community.mint}/publish/status`]: () => reply.clone(),
    });
    const html = renderToStaticMarkup(await OperatorPage(params));
    expect(html).toContain(text);
    expect(html).not.toContain("Fixture publish");
    expect(html).toContain("Epoch 7");
  });

  it("offers the publish panel when it is on and the community is not held", async () => {
    cookie = TOKEN;
    api({
      "/status": () => json({ state: "enabled" }),
      "/session": () => json(session),
      [`/communities/${community.mint}/overview`]: () =>
        json({ ...overview, hold: { held: false } }),
      [`/communities/${community.mint}/publish/status`]: () =>
        json({ state: "enabled", build: null }),
    });
    expect(renderToStaticMarkup(await OperatorPage(params))).toContain(`Fixture publish ${WALLET}`);
  });

  it("shows a setup session only the init panel, and no reads", async () => {
    cookie = TOKEN;
    const fetch = api({
      "/status": () => json({ state: "enabled" }),
      "/session": () => json({ ...session, role: "setup" }),
      [`/communities/${community.mint}/publish/status`]: () =>
        json({ state: "enabled", build: null }),
    });
    const html = renderToStaticMarkup(await OperatorPage(params));
    expect(html).toContain(`Fixture init ${community.mint}`);
    expect(html).not.toContain("Payout gate per epoch");
    expect(fetch.mock.calls.map(([u]) => String(u))).not.toContain(
      `https://api.test/admin/v1/operator/communities/${community.mint}/overview`,
    );
  });

  it("never shows another community's session", async () => {
    cookie = TOKEN;
    api({
      "/status": () => json({ state: "enabled" }),
      "/session": () => json({ ...session, mint: "OtherMint" }),
    });
    expect(renderToStaticMarkup(await OperatorPage(params))).toContain("Not the admin");
  });

  it("is 404 for an unknown community", async () => {
    vi.mocked(readCommunity).mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(OperatorPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
