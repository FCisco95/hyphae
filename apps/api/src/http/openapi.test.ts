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
    expect(Object.keys(doc.paths).sort()).toEqual(served);
  });

  it("describes each path parameter, and every answer with a schema from the v1 contract", () => {
    for (const [path, item] of Object.entries(doc.paths)) {
      const op = item.get;
      if (!op) throw new Error(`${path}: no GET`);
      for (const name of path.match(/\{(\w+)\}/g) ?? []) {
        expect(
          op.parameters?.some((p) => `{${p.name}}` === name && p.in === "path"),
          path,
        ).toBe(true);
      }
      const ok = op.responses["200"]?.content?.["application/json"]?.schema as { $ref: string };
      expect(
        doc.components.schemas[ok.$ref.replace("#/components/schemas/", "")],
        path,
      ).toBeDefined();
      for (const status of ["400", "429", "503"]) expect(op.responses[status], path).toBeDefined();
    }
  });

  it("documents each member's payout status on rows, leaderboard entries and the contribution", () => {
    type Props = { properties: Record<string, Props & { items?: Props }> };
    const schemas = doc.components.schemas as Record<string, Props>;
    const statuses = (payout: unknown) =>
      (payout as { anyOf: { properties: { status: { enum: string[] } } }[] }).anyOf.flatMap(
        (o) => o.properties.status.enum,
      );
    const all = ["unpaid_epoch", "published", "payable", "held", "not_payable"];
    expect(
      statuses(schemas.Contributions?.properties.contributions?.items?.properties.payout),
    ).toEqual(all);
    expect(statuses(schemas.Leaderboard?.properties.entries?.items?.properties.payout)).toEqual(
      all,
    );
    expect(statuses(schemas.Contribution?.properties.payout)).toEqual(all);
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
