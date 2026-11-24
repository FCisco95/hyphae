import { z } from "zod";
import {
  AdminCommunitySchema,
  AdminIntakeUpdateSchema,
  OperatorChallengeRequestSchema,
  OperatorChallengeSchema,
  OperatorInitBuildSchema,
  OperatorInitRequestSchema,
  OperatorInitSubmitSchema,
  OperatorOverviewSchema,
  OperatorPayableSchema,
  OperatorPublishBuildSchema,
  OperatorPublishStatusSchema,
  OperatorPublishSubmitSchema,
  OperatorSessionCreatedSchema,
  OperatorSessionRequestSchema,
  OperatorSessionSchema,
  OperatorStatusSchema,
  OperatorSubmitRequestSchema,
} from "../../core/src/admin-api.js";

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
const responses = (method: "GET" | "PUT") => ({
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
    headers: { ...headers, Allow: { schema: { type: "string", const: method } } },
  },
  "429": {
    ...error("unavailable", "Too many requests. Wait before a deliberate new request."),
    headers: { ...headers, "Retry-After": { schema: { type: "string", pattern: "^[0-9]+$" } } },
  },
  "503": error(
    "unavailable",
    method === "GET"
      ? "Provider/database/deadline failure; this read does not change state."
      : "Provider/database/deadline failure. A write may have committed.",
  ),
});
const parameters = [
  {
    name: "mint",
    in: "path",
    required: true,
    schema: { type: "string", pattern: "^[A-Za-z0-9]{1,64}$" },
  },
];

const operatorError = (codes: string[], description: string) => ({
  description,
  headers,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["error"],
        additionalProperties: false,
        properties: { error: { type: "string", enum: codes } },
      },
    },
  },
});
const operatorResponses = (ok: string, allow: string, extra: Record<string, unknown> = {}) => ({
  "200": { description: "Current state.", headers, content: content(ok) },
  "404": operatorError(
    ["disabled", "not_found"],
    "disabled: the operator surface is off (ADMIN_API_ENABLED=off); not_found: unknown community or epoch.",
  ),
  "405": {
    ...error("invalid_request", "Unsupported method; Allow lists the supported ones."),
    headers: { ...headers, Allow: { schema: { type: "string", const: allow } } },
  },
  "429": {
    ...error("unavailable", "Too many requests. Wait before a deliberate new request."),
    headers: { ...headers, "Retry-After": { schema: { type: "string", pattern: "^[0-9]+$" } } },
  },
  "503": error("unavailable", "Database, chain or deadline failure. Nothing changed."),
  ...extra,
});
const sessionErrors = {
  "401": error("unauthorized", "Missing, unknown or expired operator session."),
  "403": error(
    "forbidden",
    "The session's wallet is no longer the community's on-chain admin (the session ends), or the session belongs to another community.",
  ),
};

// The operator page (roadmap item 3, part A): read-only, no signing or publishing path.
const operatorPaths = {
  "/admin/v1/operator/status": {
    get: {
      operationId: "getOperatorStatus",
      summary: "Whether the operator surface is on",
      responses: operatorResponses("OperatorStatus", "GET"),
    },
  },
  "/admin/v1/operator/challenge": {
    post: {
      operationId: "createOperatorChallenge",
      summary: "A one-use, 5-minute sign-in message for a wallet",
      description:
        "One line of printable ASCII naming the purpose, domain, network, community, wallet, nonce and times; it approves no transaction. Sign it with signMessage or the Solana CLI's sign-offchain-message (Ledger). Issuing does not check the wallet; the session step does.",
      requestBody: {
        required: true,
        description: "Strict JSON object; at most 1024 UTF-8 bytes.",
        content: content("OperatorChallengeRequest"),
      },
      responses: operatorResponses("OperatorChallenge", "POST", {
        "400": error("invalid_request", "Malformed body or content type."),
        "403": error("forbidden", "The community is not bound to an on-chain account."),
      }),
    },
  },
  "/admin/v1/operator/session": {
    get: {
      operationId: "getOperatorSession",
      summary: "The current session; rechecks the on-chain admin",
      security: [{ operatorSession: [] }],
      responses: operatorResponses("OperatorSession", "GET, POST, DELETE", sessionErrors),
    },
    post: {
      operationId: "createOperatorSession",
      summary: "Trade a signed challenge for a session token",
      description:
        "The challenge is spent by this call whatever its outcome. The signature must be the challenge wallet's ed25519 signature (base58) over the message, raw or in Solana's off-chain message envelope, and that wallet must be the admin of the community's bound on-chain account. The token is returned once; keep it server-side (httpOnly cookie). Sessions last 4 hours, absolute.",
      requestBody: {
        required: true,
        description: "Strict JSON object; at most 1024 UTF-8 bytes.",
        content: content("OperatorSessionRequest"),
      },
      responses: operatorResponses("OperatorSessionCreated", "GET, POST, DELETE", {
        "400": error("invalid_request", "Malformed body or content type."),
        "401": error("unauthorized", "Unknown, used or expired challenge, or a bad signature."),
        "403": error("forbidden", "A valid signature by a wallet that is not the on-chain admin."),
      }),
    },
    delete: {
      operationId: "endOperatorSession",
      summary: "Sign out",
      security: [{ operatorSession: [] }],
      responses: operatorResponses("OperatorSessionEnded", "GET, POST, DELETE", {
        "401": sessionErrors["401"],
      }),
    },
  },
  "/admin/v1/operator/communities/{mint}/overview": {
    get: {
      operationId: "getOperatorOverview",
      summary: "Gate per epoch, top-up, hold, raids and job health",
      description:
        "Read-only. The top-up uses the same pricing as the gate-ready message; its status says why there is none.",
      security: [{ operatorSession: [] }],
      parameters,
      responses: operatorResponses("OperatorOverview", "GET", {
        ...sessionErrors,
        "400": error("invalid_request", "Malformed mint or a query string."),
      }),
    },
  },
  "/admin/v1/operator/communities/{mint}/epochs/{index}/payable": {
    get: {
      operationId: "getOperatorPayable",
      summary: "Payable wallets of one epoch",
      description:
        "Wallets only, sorted by address: never a handle, member, points or Telegram id beside them. Empty for an epoch the gate does not judge (open or published).",
      security: [{ operatorSession: [] }],
      parameters: [
        ...parameters,
        {
          name: "index",
          in: "path",
          required: true,
          schema: { type: "string", pattern: "^(0|[1-9][0-9]{0,8})$" },
        },
      ],
      responses: operatorResponses("OperatorPayable", "GET", {
        ...sessionErrors,
        "400": error("invalid_request", "Malformed mint or epoch index."),
      }),
    },
  },
};

// Part B: browser publish and init-community, off unless OPERATOR_PUBLISH_ENABLED=on. The API
// builds the transaction the CLI would and keeps its message bytes; the admin's wallet signs; only
// the signature comes back. The API never takes transaction bytes and holds no key.
const publishResponses = (ok: string, allow: string, extra: Record<string, unknown> = {}) =>
  operatorResponses(ok, allow, {
    ...sessionErrors,
    "403": error(
      "forbidden",
      "Another community's session, the wrong session kind (publish needs an admin session, init a setup session), or the wallet is no longer the on-chain admin.",
    ),
    "404": operatorError(
      ["disabled", "not_found"],
      "disabled: OPERATOR_PUBLISH_ENABLED or ADMIN_API_ENABLED is off; not_found: an API without these routes.",
    ),
    ...extra,
  });
const submitBody = {
  required: true,
  description:
    "The wallet's ed25519 signature (base58) over the build's message bytes, exactly as built. Strict JSON object; at most 1024 UTF-8 bytes.",
  content: content("OperatorSubmitRequest"),
};
const publishPaths = {
  "/admin/v1/operator/communities/{mint}/publish/status": {
    get: {
      operationId: "getOperatorPublishStatus",
      summary: "Whether browser publish is on, and this session's latest build",
      security: [{ operatorSession: [] }],
      parameters,
      responses: publishResponses("OperatorPublishStatus", "GET"),
    },
  },
  "/admin/v1/operator/communities/{mint}/publish/build": {
    post: {
      operationId: "buildOperatorPublish",
      summary: "Plan the next decided epoch and build its publish_epoch for the wallet",
      description:
        "Runs publish-epoch run's planner and chain code with a hand-off signer: refusals (recorded hold, no payout policy, no chain binding, wallet not the on-chain admin) come first; an epoch below the threshold is rolled over as the CLI does. awaiting_signature returns the unsigned transaction, its message bytes and every number it commits to. One open build per community, single use, valid until its blockhash expires (at most 120 s).",
      security: [{ operatorSession: [] }],
      parameters,
      requestBody: {
        required: true,
        description: "An empty JSON object.",
        content: {
          "application/json": { schema: { type: "object", additionalProperties: false } },
        },
      },
      responses: publishResponses("OperatorPublishBuild", "POST", {
        "400": error("invalid_request", "Malformed mint, body or content type."),
      }),
    },
  },
  "/admin/v1/operator/communities/{mint}/publish/submit": {
    post: {
      operationId: "submitOperatorPublish",
      summary: "Send a signed build and record it as the CLI run does",
      description:
        "The build is spent by this call whatever its outcome. The signature must verify over the stored bytes with the session's wallet. The planner runs again with every check; it sends only if it reaches the same publish_epoch, byte for byte (otherwise plan_changed). Up to 90 s: on a timeout, read publish/status.",
      security: [{ operatorSession: [] }],
      parameters,
      requestBody: submitBody,
      responses: publishResponses("OperatorPublishSubmit", "POST", {
        "400": error("invalid_request", "Malformed mint, body or content type."),
      }),
    },
  },
  "/admin/v1/operator/communities/{mint}/init/build": {
    post: {
      operationId: "buildOperatorInit",
      summary: "Build initialize_community for a recorded, not yet initialized community",
      description:
        "Setup sessions only (the community is recorded in setup-records.ts with this wallet as admin and is not bound). The fee recipient must equal the recorded one. Runs init-community's checks: program deployed, community account absent, fee recipient a System-owned wallet. Writes no database.",
      security: [{ operatorSession: [] }],
      parameters,
      requestBody: {
        required: true,
        description: "Strict JSON object; at most 1024 UTF-8 bytes.",
        content: content("OperatorInitRequest"),
      },
      responses: publishResponses("OperatorInitBuild", "POST", {
        "400": error("invalid_request", "Malformed mint, body or content type."),
      }),
    },
  },
  "/admin/v1/operator/communities/{mint}/init/submit": {
    post: {
      operationId: "submitOperatorInit",
      summary: "Send a signed initialize_community and read the account back",
      description:
        "As publish/submit. Binding communities.chain_address stays the operator's bind-community step.",
      security: [{ operatorSession: [] }],
      parameters,
      requestBody: submitBody,
      responses: publishResponses("OperatorInitSubmit", "POST", {
        "400": error("invalid_request", "Malformed mint, body or content type."),
      }),
    },
  },
};

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
          responses: responses("GET"),
        },
      },
      "/admin/v1/communities/{mint}/intake": {
        put: {
          operationId: "setAdminIntakePaused",
          summary: "Pause or resume new reward submissions",
          description:
            "Requires deliberate administrator confirmation. Copy expected_paused_at from the latest authenticated read; CAS is checked under the shared community lock. Same-state updates preserve the timestamp. Does not change payouts, epoch dates, rubrics or custody. Clients must not add automatic retry loops. An HTTP transport may independently replay a request; timestamp CAS rejects stale updates. On 409 refresh before deciding; on timeout, abort, network error, 503, a gateway 5xx or an unreadable response the write outcome can be unknown: read current state before another deliberate change.",
          security: [{ adminToken: [] }],
          parameters,
          requestBody: {
            required: true,
            description: "Strict JSON object; at most 1024 UTF-8 bytes.",
            content: content("AdminIntakeUpdate"),
          },
          responses: {
            ...responses("PUT"),
            "409": error("conflict", "Pause timestamp changed; refresh before a new confirmation."),
          },
        },
      },
      ...operatorPaths,
      ...publishPaths,
    },
    components: {
      securitySchemes: {
        operatorSession: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "hop_ followed by 43 base64url characters",
          description:
            "Operator session token from createOperatorSession. Every request rechecks that the session's wallet is still the community's on-chain admin. Cookies are not API authentication.",
        },
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
        OperatorStatus: z.toJSONSchema(OperatorStatusSchema),
        OperatorChallengeRequest: z.toJSONSchema(OperatorChallengeRequestSchema),
        OperatorChallenge: z.toJSONSchema(OperatorChallengeSchema),
        OperatorSessionRequest: z.toJSONSchema(OperatorSessionRequestSchema),
        OperatorSession: z.toJSONSchema(OperatorSessionSchema),
        OperatorSessionCreated: z.toJSONSchema(OperatorSessionCreatedSchema),
        OperatorSessionEnded: {
          type: "object",
          required: ["ended"],
          additionalProperties: false,
          properties: { ended: { type: "boolean", const: true } },
        },
        OperatorOverview: z.toJSONSchema(OperatorOverviewSchema),
        OperatorPayable: z.toJSONSchema(OperatorPayableSchema),
        OperatorPublishStatus: z.toJSONSchema(OperatorPublishStatusSchema),
        OperatorPublishBuild: z.toJSONSchema(OperatorPublishBuildSchema),
        OperatorSubmitRequest: z.toJSONSchema(OperatorSubmitRequestSchema),
        OperatorPublishSubmit: z.toJSONSchema(OperatorPublishSubmitSchema),
        OperatorInitRequest: z.toJSONSchema(OperatorInitRequestSchema),
        OperatorInitBuild: z.toJSONSchema(OperatorInitBuildSchema),
        OperatorInitSubmit: z.toJSONSchema(OperatorInitSubmitSchema),
      },
    },
  };
}
