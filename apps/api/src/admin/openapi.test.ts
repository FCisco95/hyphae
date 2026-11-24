import type { Db } from "@hyphae/db";
import { expect, it } from "vitest";
import { adminOpenApiDocument } from "../../../../packages/admin-client/src/openapi.js";
import { buildStore } from "../admin-auth/builds.js";
import { operatorAuthStore } from "../admin-auth/store.js";
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
  operator: {
    store: operatorAuthStore(),
    origins: ["https://hyphae.test"],
    network: "solana:devnet",
    onChainAdmin: async () => {
      throw new Error("must not read the chain for missing credentials");
    },
    publishEnabled: true,
    publish: {
      network: "solana:devnet",
      chain: async () => {
        throw new Error("must not read the chain for missing credentials");
      },
      sending: async () => {
        throw new Error("must not read the chain for missing credentials");
      },
      send: async () => {
        throw new Error("must not send for missing credentials");
      },
      blockHeight: async () => {
        throw new Error("must not read the chain for missing credentials");
      },
      builds: buildStore(),
      setupRecords: [],
    },
  },
});

it("documents every actual admin route without extending the server surface", () => {
  const paths = routes.routes
    .filter((route) => route.method === "ALL" && !route.path.endsWith("/*"))
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

it.each([
  "/operator/communities/MintA/overview",
  "/operator/communities/MintA/epochs/1/payable",
  "/operator/session",
  "/operator/communities/MintA/publish/status",
  "POST /operator/communities/MintA/publish/build",
  "POST /operator/communities/MintA/publish/submit",
  "POST /operator/communities/MintA/init/build",
  "POST /operator/communities/MintA/init/submit",
])("answers %s without a session as unauthorized, never reading the chain", async (route) => {
  const [method, path] = route.startsWith("POST ") ? ["POST", route.slice(5)] : ["GET", route];
  const result = await routes.request(path as string, { method: method as string });
  expect(result.status).toBe(401);
  expect(await result.json()).toEqual({ error: "unauthorized" });
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
});

it("documents every operator route's Allow header as the server sends it", async () => {
  const p = document.paths;
  for (const [path, documented] of [
    ["/operator/status", p["/admin/v1/operator/status"].get],
    ["/operator/challenge", p["/admin/v1/operator/challenge"].post],
    ["/operator/session", p["/admin/v1/operator/session"].get],
    [
      "/operator/communities/MintA/overview",
      p["/admin/v1/operator/communities/{mint}/overview"].get,
    ],
    [
      "/operator/communities/MintA/epochs/1/payable",
      p["/admin/v1/operator/communities/{mint}/epochs/{index}/payable"].get,
    ],
    [
      "/operator/communities/MintA/publish/status",
      p["/admin/v1/operator/communities/{mint}/publish/status"].get,
    ],
    [
      "/operator/communities/MintA/publish/build",
      p["/admin/v1/operator/communities/{mint}/publish/build"].post,
    ],
    [
      "/operator/communities/MintA/publish/submit",
      p["/admin/v1/operator/communities/{mint}/publish/submit"].post,
    ],
    [
      "/operator/communities/MintA/init/build",
      p["/admin/v1/operator/communities/{mint}/init/build"].post,
    ],
    [
      "/operator/communities/MintA/init/submit",
      p["/admin/v1/operator/communities/{mint}/init/submit"].post,
    ],
  ] as const) {
    const result = await routes.request(path, { method: "PATCH" });
    expect(result.status, path).toBe(405);
    expect(documented.responses["405"].headers.Allow.schema.const, path).toBe(
      result.headers.get("Allow"),
    );
  }
});
