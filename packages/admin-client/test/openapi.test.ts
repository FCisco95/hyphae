import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { z } from "zod";
import { AdminCommunitySchema, AdminIntakeUpdateSchema } from "../../core/src/admin-api.js";
import { adminOpenApiDocument } from "../src/openapi.js";

it("ships a standalone OpenAPI contract with no deployed server claim", () => {
  const document = adminOpenApiDocument();
  expect(document.openapi).toBe("3.1.0");
  expect(document).not.toHaveProperty("servers");
  expect(
    JSON.parse(readFileSync(new URL("../dist/openapi.json", import.meta.url), "utf8")),
  ).toEqual(document);
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(manifest.exports["./openapi.json"]).toBe("./dist/openapi.json");
  expect(manifest.files).toContain("dist/openapi.json");
});

it("preserves strict canonical shapes and the pause timestamp invariant", () => {
  const schemas = adminOpenApiDocument().components.schemas;
  const { allOf, ...community } = schemas.AdminCommunity;
  expect(community).toEqual(z.toJSONSchema(AdminCommunitySchema, { unrepresentable: "any" }));
  expect(schemas.AdminIntakeUpdate).toEqual(z.toJSONSchema(AdminIntakeUpdateSchema));
  // Zod's custom refine is not emitted by toJSONSchema: JSON consumers need the same invariant.
  expect(allOf).toEqual([
    {
      properties: {
        intake: {
          oneOf: [
            { properties: { paused: { const: false }, paused_at: { type: "null" } } },
            {
              properties: {
                paused: { const: true },
                paused_at: { type: "string", format: "date-time" },
              },
            },
          ],
        },
      },
    },
  ]);
});

it("documents bearer authority, concurrency, no cache and ambiguous write recovery", () => {
  const document = adminOpenApiDocument();
  const operations = [
    document.paths["/admin/v1/communities/{mint}"].get,
    document.paths["/admin/v1/communities/{mint}/intake"].put,
  ];
  for (const [index, operation] of operations.entries()) {
    expect(operation.security).toEqual([{ adminToken: [] }]);
    expect(operation.parameters).toContainEqual(
      expect.objectContaining({ name: "mint", in: "path", required: true }),
    );
    expect(Object.keys(operation.responses).sort()).toEqual(
      [
        "200",
        "400",
        "401",
        "403",
        "404",
        "405",
        "429",
        "503",
        ...(index === 1 ? ["409"] : []),
      ].sort(),
    );
    for (const response of Object.values(operation.responses)) {
      expect(response.headers["Cache-Control"].schema.const).toBe("private, no-store");
    }
  }
  const put = document.paths["/admin/v1/communities/{mint}/intake"].put;
  expect(put.responses["409"]).toBeDefined();
  expect(put.description).toMatch(/read.*before.*another/i);
  expect(put.requestBody.content["application/json"].schema).toEqual({
    $ref: "#/components/schemas/AdminIntakeUpdate",
  });
  expect(document.components.securitySchemes.adminToken.description).toMatch(/Telegram/);
});
