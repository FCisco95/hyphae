import type { Db } from "@hyphae/db";
import { describe, expect, it } from "vitest";
import { docsRoutes } from "./docs.js";
import { openApiDocument } from "./openapi.js";
import { readRoutes } from "./routes.js";

const app = readRoutes({ db: {} as Db, clock: async () => new Date() });
type Operation = {
  responses: Record<string, { content?: Record<string, { schema: unknown }> }>;
  parameters?: { name: string; in: string }[];
};
const doc = openApiDocument() as {
  openapi: string;
  paths: Record<string, { get?: Operation }>;
  components: { schemas: Record<string, unknown> };
};

describe("the OpenAPI document", () => {
  it("documents every GET route the read api serves, and no other", () => {
    const served = app.routes
      .filter((r) => r.method === "GET" && r.path !== "/openapi.json")
      .map((r) => `/v1${r.path.replace(/:(\w+)/g, "{$1}")}`)
      .sort();
    expect(
      Object.keys(doc.paths)
        .filter((p) => p.startsWith("/v1/") && !p.startsWith("/v1/integrations/"))
        .sort(),
    ).toEqual(served);
  });

  it("describes each path parameter, and every answer with a schema from the v1 contract", () => {
    for (const [path, item] of Object.entries(doc.paths)) {
      const op = item.get;
      if (!op) continue;
      for (const name of path.match(/\{(\w+)\}/g) ?? []) {
        expect(
          op.parameters?.some((p) => `{${p.name}}` === name && p.in === "path"),
          path,
        ).toBe(true);
      }
      const ok = op.responses["200"]?.content?.["application/json"]?.schema as {
        $ref?: string;
        oneOf?: { $ref: string }[];
      };
      const refs = ok.oneOf ?? [ok as { $ref: string }];
      expect(refs.length, path).toBeGreaterThan(0);
      for (const { $ref } of refs)
        expect(
          doc.components.schemas[$ref.replace("#/components/schemas/", "")],
          path,
        ).toBeDefined();
      for (const status of ["400", "429", "503"]) expect(op.responses[status], path).toBeDefined();
    }
  });

  it("never documents individual eligibility on public member surfaces", () => {
    type Props = { properties: Record<string, Props & { items?: Props }> };
    const schemas = doc.components.schemas as Record<string, Props>;
    for (const properties of [
      schemas.Contributions?.properties.contributions?.items?.properties,
      schemas.Leaderboard?.properties.entries?.items?.properties,
      schemas.AllTimeLeaderboard?.properties.entries?.items?.properties,
      schemas.Contribution?.properties,
    ]) {
      expect(properties).toBeDefined();
      expect(properties).not.toHaveProperty("payout");
      expect(properties).not.toHaveProperty("hold");
      expect(properties).not.toHaveProperty("rules_test");
    }
  });

  it("documents the epoch's eligibility block and the all-time leaderboard", () => {
    type Props = { properties: Record<string, { properties?: object; type?: unknown }> };
    const schemas = doc.components.schemas as Record<string, Props>;
    expect(Object.keys(schemas.Epoch?.properties.eligibility?.properties ?? {}).sort()).toEqual([
      "hold_checked_from",
      "hold_checked_until",
      "min_hold_units",
      "mint_decimals",
    ]);
    expect(schemas.AllTimeLeaderboard?.properties.epoch?.type).toBe("null");
    const raid = JSON.stringify(schemas.Raids);
    for (const field of ['"kind"', '"full_credit_until"']) expect(raid).toContain(field);
    const board = doc.paths["/v1/communities/{mint}/leaderboard"]?.get;
    expect(board?.responses["200"]?.content?.["application/json"]?.schema).toEqual({
      oneOf: [
        { $ref: "#/components/schemas/Leaderboard" },
        { $ref: "#/components/schemas/AllTimeLeaderboard" },
      ],
    });
  });

  it("documents the settle loop's payout decision on an epoch and on the community's list", () => {
    type Props = {
      properties: Record<string, Props & { items?: Props; enum?: string[]; type?: unknown }>;
      required?: string[];
    };
    const schemas = doc.components.schemas as Record<string, Props>;
    const epoch = schemas.Epoch?.properties.payout;
    const listed = schemas.Community?.properties.epochs?.items?.properties.payout;
    for (const payout of [epoch, listed]) {
      expect(payout?.properties.status?.enum).toEqual([
        "rolled_over",
        "distribution_planned",
        "distributed",
      ]);
      expect(payout?.properties.distributed_in).toBeDefined();
    }
    // Optional: an epoch without a decision has no payout, and an older api sends none.
    expect(schemas.Epoch?.required).not.toContain("payout");
    expect(schemas.Community?.properties.epochs?.items?.required).not.toContain("payout");
    const route = doc.paths["/v1/communities/{mint}/epochs/{index}"]?.get as Operation & {
      description: string;
    };
    expect(route.description).toContain("distributed_in");
  });

  it("documents the member read with its own rules test and no selector", () => {
    const me = doc.paths["/member/v1/communities/{mint}/me"]?.get as Operation & {
      security?: unknown;
    };
    expect(me.security).toEqual([{ memberToken: [] }]);
    expect(me.parameters?.map((p) => p.in)).toEqual(["path"]);
    expect(JSON.stringify(doc.components.schemas.MemberAccount)).toContain('"rules_test"');
  });

  it("documents the signed Organic raid route, its signature and its answers", () => {
    const post = (
      doc.paths as Record<
        string,
        { post?: Operation & { security?: unknown; description?: string } }
      >
    )["/v1/integrations/communities/{mint}/raids"]?.post;
    expect(post?.security).toEqual([{ organicHmac: [] }]);
    expect(post?.description).toContain("Organic-HMAC keyId=<id>, ts=<unix seconds>, sig=<hex>");
    expect(Object.keys(post?.responses ?? {}).sort()).toEqual(
      ["201", "400", "401", "403", "409", "413", "503"].sort(),
    );
    const schemas = doc.components.schemas as Record<string, { properties?: object }>;
    expect(Object.keys(schemas.OrganicRaidRequest?.properties ?? {}).sort()).toEqual([
      "actor",
      "brief",
      "closes_at",
      "idempotency_key",
      "opens_at",
      "post_url",
    ]);
  });

  it("is served as JSON under /v1", async () => {
    const r = await app.request("/openapi.json");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    expect((await r.json()).openapi).toBe("3.1.0");
  });
});

describe("the docs page", () => {
  it("loads one pinned version of its renderer, checked by hash, on the v1 document", async () => {
    const r = await docsRoutes().request("/");
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain(
      'src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1/dist/browser/standalone.js"',
    );
    expect(html).toMatch(/integrity="sha384-[A-Za-z0-9+/=]{64}"/);
    expect(html).toContain('crossorigin="anonymous"');
    expect(html).toContain("/v1/openapi.json");
  });
});
