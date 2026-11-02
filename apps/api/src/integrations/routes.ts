import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { type OrganicKey, verifyOrganic } from "./hmac.js";
import { type PostRaidResult, type RaidRequest, RaidRequestSchema } from "./raids.js";

const MINT = /^[A-Za-z0-9]{1,64}$/;
const MAX_BODY_BYTES = 16 * 1024;
const headers = { "Cache-Control": "no-store" };

// Server-to-server writes from Organic, mounted at /v1/integrations. Every request is signed
// (hmac.ts); without a configured key the route refuses everything.
export function integrationRoutes(deps: {
  key: OrganicKey | null;
  postRaid(mint: string, keyId: string, request: RaidRequest): Promise<PostRaidResult>;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  const app = new Hono();
  app.post(
    "/communities/:mint/raids",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: "bad_request" }, 413, headers),
    }),
    async (c) => {
      if (!deps.key) return c.json({ error: "not_configured" }, 503, headers);
      const url = new URL(c.req.url);
      const body = new Uint8Array(await c.req.arrayBuffer());
      const verdict = verifyOrganic(
        deps.key,
        {
          authorization: c.req.header("authorization"),
          method: c.req.method,
          path: url.pathname,
          body,
        },
        now(),
      );
      if (!verdict.ok)
        return c.json(
          { error: verdict.reason === "stale" ? "stale_request" : "unauthorized" },
          401,
          headers,
        );
      const mint = c.req.param("mint");
      if (url.search !== "" || !MINT.test(mint))
        return c.json({ error: "bad_request" }, 400, headers);
      let json: unknown;
      try {
        json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
      } catch {
        return c.json({ error: "bad_request" }, 400, headers);
      }
      const request = RaidRequestSchema.safeParse(json);
      if (!request.success) return c.json({ error: "bad_request" }, 400, headers);
      const result = await deps.postRaid(mint, verdict.keyId, request.data);
      if (result.status === 201) return c.json(result.body, 201, headers);
      return c.json({ error: result.error }, result.status, headers);
    },
  );
  app.notFound((c) => c.json({ error: "not_found" }, 404, headers));
  app.onError((err, c) => {
    // The path and the error's class only: no request body, key or driver detail.
    console.error(JSON.stringify({ integration: c.req.routePath, error: err.name }));
    return c.json({ error: "unavailable" }, 503, headers);
  });
  return app;
}
