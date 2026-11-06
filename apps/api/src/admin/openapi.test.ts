import type { Db } from "@hyphae/db";
import { expect, it } from "vitest";
import { adminOpenApiDocument } from "../../../../packages/admin-client/src/openapi.js";
import { adminRoutes } from "./routes.js";

const document = adminOpenApiDocument();
const routes = adminRoutes({
  db: {} as Db,
  enabled: true,
  identity: {
    verify: async () => {
      throw new Error("must not use providers for missing credentials");
    },
    currentUser: async () => {
      throw new Error("must not use providers for missing credentials");
    },
  },
  telegramAdmin: async () => {
    throw new Error("must not use providers for missing credentials");
  },
});

it("documents every actual admin route without extending the server surface", () => {
  const paths = routes.routes
    .filter((route) => route.method === "ALL" && route.path !== "/*")
    .map((route) => `/admin/v1${route.path.replace(/:(\w+)/g, "{$1}")}`)
    .sort();
  expect(Object.keys(document.paths).sort()).toEqual(paths);
});

it.each([
  ["GET", "/communities/MintA", "GET"],
  ["PUT", "/communities/MintA/intake", "PUT"],
] as const)(
  "keeps documented %s credentials and method errors aligned",
  async (method, path, allow) => {
    const input =
      method === "PUT"
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paused: true, expected_paused_at: null }),
          }
        : {};
    const result = await routes.request(path, { method, ...input });
    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({ error: "unauthorized" });
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    const unsupported = await routes.request(path, { method: "POST" });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("Allow")).toBe(allow);
    expect(await unsupported.json()).toEqual({ error: "invalid_request" });
    const documented =
      method === "GET"
        ? document.paths["/admin/v1/communities/{mint}"].get
        : document.paths["/admin/v1/communities/{mint}/intake"].put;
    expect(documented.responses["405"].headers.Allow.schema).toEqual({
      type: "string",
      const: unsupported.headers.get("Allow"),
    });
  },
);
