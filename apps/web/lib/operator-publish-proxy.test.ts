import { afterEach, describe, expect, it, vi } from "vitest";
import * as initBuild from "../app/api/operator/[mint]/init/build/route.js";
import * as publishBuild from "../app/api/operator/[mint]/publish/build/route.js";
import * as publishStatus from "../app/api/operator/[mint]/publish/status/route.js";
import * as publishSubmit from "../app/api/operator/[mint]/publish/submit/route.js";
import { OPERATOR_COOKIE } from "./operator-server.js";

const TOKEN = `hop_${"A".repeat(43)}`;
const SITE = "https://hyphae.test";
const MINT = "CommunityA";
const BUILD = "11111111-2222-4333-8444-555555555555";
const SIG = "2".repeat(88);
const params = { params: Promise.resolve({ mint: MINT }) };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const upstream = (reply: () => Response) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => reply());
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("HYPHAE_API_URL", "https://api.test/");
  return fetch;
};
const post = (
  path: string,
  body: unknown,
  o: { origin?: string | null; cookie?: boolean } = {},
) => {
  const headers = new Headers({ "content-type": "application/json" });
  if (o.origin !== null) headers.set("origin", o.origin ?? SITE);
  if (o.cookie !== false) headers.set("cookie", `${OPERATOR_COOKIE}=${TOKEN}`);
  return new Request(`${SITE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("publish proxy", () => {
  it("passes only the signature and build id to the API, with the cookie's token", async () => {
    const fetch = upstream(() => json({ status: "refused", reason: "plan_changed" }));
    const r = await publishSubmit.POST(
      post(`/api/operator/${MINT}/publish/submit`, {
        build_id: BUILD,
        signature: SIG,
        transaction: "AAAA",
      }),
      params,
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "refused", reason: "plan_changed" });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      `https://api.test/admin/v1/operator/communities/${MINT}/publish/submit`,
    );
    expect(JSON.parse(String(init?.body))).toEqual({ build_id: BUILD, signature: SIG });
    expect(((init?.headers ?? {}) as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("refuses a cross-site POST, no cookie or a bad mint before calling the API", async () => {
    const fetch = upstream(() => json({}));
    const cross = await publishBuild.POST(
      post(`/api/operator/${MINT}/publish/build`, {}, { origin: "https://evil.test" }),
      params,
    );
    expect(cross.status).toBe(403);
    const none = await publishBuild.POST(
      post(`/api/operator/${MINT}/publish/build`, {}, { origin: null }),
      params,
    );
    expect(none.status).toBe(403);
    const signedOut = await initBuild.POST(
      post(`/api/operator/${MINT}/init/build`, { fee_recipient: "x" }, { cookie: false }),
      params,
    );
    expect(signedOut.status).toBe(401);
    const bad = await publishBuild.POST(post("/api/operator/bad!/publish/build", {}), {
      params: Promise.resolve({ mint: "bad!" }),
    });
    expect(bad.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes disabled and an absent route through so the page can say off", async () => {
    upstream(() => json({ error: "disabled" }, 404));
    const headers = { cookie: `${OPERATOR_COOKIE}=${TOKEN}` };
    const off = await publishStatus.GET(
      new Request(`${SITE}/api/operator/${MINT}/publish/status`, { headers }),
      params,
    );
    expect(off.status).toBe(404);
    expect(await off.json()).toEqual({ error: "disabled" });
    upstream(() => json({ error: "not_found" }, 404));
    const absent = await publishStatus.GET(
      new Request(`${SITE}/api/operator/${MINT}/publish/status`, { headers }),
      params,
    );
    expect(await absent.json()).toEqual({ error: "not_found" });
  });

  it("allows only POST for build and submit, and GET for status", async () => {
    for (const handler of [publishBuild.GET, publishSubmit.GET, publishStatus.POST]) {
      expect((await handler()).status).toBe(405);
    }
  });
});
