import { describe, expect, it } from "vitest";
import { linkRoutes } from "./routes.js";
import { testTenant } from "./test-wallet.js";

const CSP =
  "default-src 'none'; script-src 'self'; connect-src 'self'; img-src data:; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

describe("link page", () => {
  it("serves the page with a strict CSP, no referrer and no inline script", async () => {
    const app = linkRoutes({ db: {} as never, tenant: testTenant });
    const r = await app.request("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-security-policy")).toBe(CSP);
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(r.headers.get("cache-control")).toBe("no-store");
    const html = await r.text();
    expect(html).toContain('<script type="module" src="/link/app.js"></script>');
    expect(html.match(/<script/g)).toHaveLength(1);
  });
});
