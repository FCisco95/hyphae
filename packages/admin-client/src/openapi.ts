import { z } from "zod";
import { AdminCommunitySchema, AdminIntakeUpdateSchema } from "../../core/src/admin-api.js";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const content = (name: string) => ({ "application/json": { schema: ref(name) } });
const headers = {
  "Cache-Control": {
    description: "Private responses must not be cached.",
    schema: { type: "string", const: "private, no-store" },
  },
};
const error = (code: string, description: string) => ({
  description,
  headers,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["error"],
        additionalProperties: false,
        properties: { error: { type: "string", const: code } },
      },
    },
  },
});
const responses = {
  "200": { description: "Authorized current state.", headers, content: content("AdminCommunity") },
  "400": error("invalid_request", "Malformed mint, query string, content type or update body."),
  "401": error("unauthorized", "Missing, malformed or invalid app-bound user credential."),
  "403": error(
    "forbidden",
    "Current identity or community administrator authority is not verified.",
  ),
  "404": error("not_found", "Disabled administration surface or unknown community."),
  "405": {
    ...error("invalid_request", "Unsupported method; Allow identifies the supported method."),
    headers: { ...headers, Allow: { schema: { type: "string", enum: ["GET", "PUT"] } } },
  },
  "429": {
    ...error("unavailable", "Too many requests. Wait before a deliberate new request."),
    headers: { ...headers, "Retry-After": { schema: { type: "string", pattern: "^[0-9]+$" } } },
  },
  "503": error("unavailable", "Provider/database/deadline failure. A write may have committed."),
};
const parameters = [
  {
    name: "mint",
    in: "path",
    required: true,
    schema: { type: "string", pattern: "^[A-Za-z0-9]{1,64}$" },
  },
];

// A build artifact, not a new runtime endpoint or an assertion about an installed service.
export function adminOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Hyphae private administration API",
      version: "1.0.0",
      description:
        "Source contract only; disabled by default. Compatible API installation, activation and real provider verification are separate. No query arguments are accepted.",
    },
    paths: {
      "/admin/v1/communities/{mint}": {
        get: {
          operationId: "getAdminCommunity",
          summary: "Read the designated administrator's community state",
          description:
            "Fresh identity and Telegram authority checks; no public administrator data.",
          security: [{ adminToken: [] }],
          parameters,
          responses,
        },
      },
      "/admin/v1/communities/{mint}/intake": {
        put: {
          operationId: "setAdminIntakePaused",
          summary: "Pause or resume new reward submissions",
          description:
            "Requires deliberate administrator confirmation. Copy expected_paused_at from the latest authenticated read; CAS is checked under the shared community lock. Same-state updates preserve the timestamp. Does not change payouts, epoch dates, rubrics or custody. Never retry automatically. On 409 refresh before deciding; on timeout, abort, network error, 503 or an unreadable response the write outcome can be unknown: read current state before another deliberate change.",
          security: [{ adminToken: [] }],
          parameters,
          requestBody: {
            required: true,
            description: "Strict JSON object; at most 1024 UTF-8 bytes.",
            content: content("AdminIntakeUpdate"),
          },
          responses: {
            ...responses,
            "409": error("conflict", "Pause timestamp changed; refresh before a new confirmation."),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        adminToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Fresh app-bound Privy user JWT. Current unique Telegram identity, designated community administrator and live Telegram administrator/creator role are rechecked. A wallet or technical web token grants no authority. Cookies are not API authentication.",
        },
      },
      schemas: {
        AdminCommunity: {
          ...z.toJSONSchema(AdminCommunitySchema, { unrepresentable: "any" }),
          // JSON Schema cannot infer Zod's refine; retain the cross-field invariant explicitly.
          allOf: [
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
          ],
        },
        AdminIntakeUpdate: z.toJSONSchema(AdminIntakeUpdateSchema),
      },
    },
  };
}
