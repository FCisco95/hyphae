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
    expect(html).toContain('id="copy-link"');
    expect(html).toContain('id="manual-copy" hidden');
    expect(html).toContain('for="private-link"');
    expect(html).toContain('id="private-link" readonly');
    expect(html).toContain('id="copy-status" role="status"');
    expect(html).toContain('id="retry"');
    expect(html).not.toMatch(/<style|style=|onclick=|phantom\.com|solflare\.com/);
  });
  it("serves one same-origin stylesheet with nothing external or inline", async () => {
    const app = linkRoutes({ db: {} as never, tenant: testTenant });
    const page = await (await app.request("/")).text();
    expect(page).toContain('<link rel="stylesheet" href="/link/style.css">');
    const r = await app.request("/style.css");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/css");
    expect(r.headers.get("content-security-policy")).toBe(CSP);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const css = await r.text();
    expect(css).not.toMatch(/@import|url\(\s*["']?(?:https?:|\/\/)|expression\(|javascript:/i);
    expect(css).toMatch(/prefers-color-scheme: dark/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it("shows the signing address and a message preview slot, and still has one script", async () => {
    const app = linkRoutes({ db: {} as never, tenant: testTenant });
    const html = await (await app.request("/")).text();
    expect(html).toContain('id="signing-origin"');
    expect(html).toContain('id="message-preview"');
    expect(html).toMatch(/<div id="app"[^>]*data-state=/);
  });
});
