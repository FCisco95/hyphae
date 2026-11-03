import { MemberAccountSchema, PublicRaidSchema, PublicRaidsSchema, ReadApiV1 } from "@hyphae/core";
import { z } from "zod";
import { RaidRequestSchema } from "../integrations/raids.js";
import { AllTimeLeaderboardSchema, EpochSchema } from "./schemas.js";

// The v1 contract as OpenAPI 3.1. Every schema is generated from the zod schemas the api's own
// tests parse its responses with, so the document cannot drift from what the api serves; a test
// checks that every served route is documented.

const schemas = {
  Community: ReadApiV1.community,
  Raids: PublicRaidsSchema,
  Epoch: EpochSchema,
  Contributions: ReadApiV1.contributions,
  Leaderboard: ReadApiV1.leaderboard,
  AllTimeLeaderboard: AllTimeLeaderboardSchema,
  Contribution: ReadApiV1.contribution,
  Claim: ReadApiV1.claim,
  WalletClaims: ReadApiV1.walletClaims,
  WalletRecord: ReadApiV1.walletRecord,
  Error: ReadApiV1.error,
  MemberAccount: MemberAccountSchema,
  OrganicRaidRequest: RaidRequestSchema,
  OrganicRaid: z.strictObject({ raid: PublicRaidSchema }),
  IntegrationError: z.strictObject({
    error: z.enum([
      "bad_request",
      "invalid_post_url",
      "post_unreadable",
      "invalid_window",
      "scheduling_unsupported",
      "unauthorized",
      "stale_request",
      "community_not_registered",
      "intake_paused",
      "open_raid_limit",
      "idempotency_conflict",
      "request_in_progress",
      "not_found",
      "not_configured",
      "telegram_unavailable",
      "unavailable",
    ]),
  }),
  MemberError: z.strictObject({
    error: z.enum(["invalid_request", "unauthorized", "not_found", "unavailable"]),
  }),
};

const ref = (name: keyof typeof schemas) => ({ $ref: `#/components/schemas/${name}` });
type Name = keyof typeof schemas;
const json = (name: Name | Name[]) => ({
  "application/json": {
    schema: Array.isArray(name) ? { oneOf: name.map(ref) } : ref(name),
  },
});

const path = (name: string, description: string, schema: object) => ({
  name,
  in: "path",
  required: true,
  description,
  schema,
});
const query = (name: string, description: string, schema: object, required = false) => ({
  name,
  in: "query",
  required,
  description,
  schema,
});
const base58 = { type: "string", pattern: "^[1-9A-HJ-NP-Za-km-z]{32,44}$" };
const mint = path("mint", "The community's token mint.", {
  type: "string",
  pattern: "^[A-Za-z0-9]{1,64}$",
});
const index = path("index", "The epoch index, from 1.", { type: "integer", minimum: 1 });
const wallet = path("wallet", "A Solana address.", base58);
const paging = [
  query("offset", "Entries to skip.", { type: "integer", minimum: 0, default: 0 }),
  query("limit", "Entries per page.", { type: "integer", minimum: 1, maximum: 100, default: 50 }),
];

const limited = {
  "RateLimit-Policy": { $ref: "#/components/headers/RateLimitPolicy" },
  "RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
  "RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
  "RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
};
const error = (description: string) => ({ description, headers: limited, content: json("Error") });

function get(
  summary: string,
  description: string,
  body: Name | Name[],
  parameters: object[],
  notFound: string | null,
) {
  return {
    get: {
      summary,
      description,
      parameters,
      responses: {
        "200": { description: "OK", headers: limited, content: json(body) },
        "400": error("A malformed parameter: `bad_request`."),
        ...(notFound ? { "404": error(notFound) } : {}),
        "429": {
          ...error("Too many requests from this address in the window: `unavailable`."),
          headers: { ...limited, "Retry-After": { $ref: "#/components/headers/RetryAfter" } },
        },
        "503": error("The database could not be read: `unavailable`."),
      },
    },
  };
}

export function openApiDocument() {
  const header = (description: string) => ({ description, schema: { type: "string" } });
  return {
    openapi: "3.1.0",
    info: {
      title: "Hyphae read API",
      version: "1",
      description: [
        "The /v1 reads are public, read-only and unauthenticated. JSON in snake_case. Exact integers (point units,",
        "lamports) are decimal strings; timestamps are RFC 3339 UTC with microseconds.",
        "",
        "A section the api cannot confirm is `{ status: 'unavailable', reason }`, never a zero.",
        "Settlement and payment are read against Solana: a transaction is shown only when the",
        "chain proves it created the account it names.",
        "",
        "Inside v1 fields are only added. Parse loosely: an older api may lack a newer field.",
        "",
        "`/member/v1` answers a signed-in member about their own record only, with their app token.",
        "`/v1/integrations` takes signed server-to-server writes from Organic.",
      ].join("\n"),
    },
    paths: {
      "/v1/communities/{mint}": get(
        "A community",
        "Its name, current epoch and every served epoch. An epoch the automatic settle loop has decided carries `payout`: `rolled_over` (its accrual waits in the vault for a later distribution), `distribution_planned` or `distributed`, with `distributed_in` the index the distribution is published under.",
        "Community",
        [mint],
        "No community with this mint.",
      ),
      "/v1/communities/{mint}/raids": get(
        "A community's raids",
        "Up to 20 active or scheduled raids, earliest deadline first, and up to 6 recent closed or cancelled raids. Approved records only; safe X links and recorded post text, no private member or moderation metadata. Scheduled and cancelled raids omit post content and briefs. Truncated text ends with an ellipsis. A raid window never extends the reward epoch deadline. `kind` is the raid's type (every served raid is an X post raid); `full_credit_until` is when full timing credit ends, computed from the timing pinned to the epoch the raid opened in, null when no epoch pins one and for a cancelled raid.",
        "Raids",
        [mint],
        "No community with this mint.",
      ),
      "/v1/communities/{mint}/epochs/{index}": get(
        "An epoch",
        [
          "Window, status, pinned configuration, counts, the frozen snapshot, and the settlement: the published allocation and each member's payment, read against the chain. For an epoch the automatic settle loop distributed under its own index, the settlement is that distribution: its gross is the sum of every epoch it pays (`payout.distributed_in` on each), its payable members are the members with a leaf, and each leaf's evidence is a member-distribution manifest. An epoch paid under a later index has no settlement of its own; `payout` says where it was paid.",
          "`eligibility`: the pinned minimum balance of the community's mint in base units (`0`: no hold condition), the mint's decimals from the chain (null when they could not be read in time), and the window in which a member's balance is read: from the close to 24 hours after it. There is no snapshot instant.",
        ].join("\n\n"),
        "Epoch",
        [mint, index],
        "No such community or served epoch.",
      ),
      "/v1/communities/{mint}/epochs/{index}/contributions": get(
        "An epoch's contributions",
        "Audit rows in intake order, each with its selected judgement. Member eligibility checklists are private; published payment totals are on the epoch settlement.",
        "Contributions",
        [
          mint,
          index,
          ...paging,
          query("member", "Only this member's rows.", { type: "string", format: "uuid" }),
        ],
        "No such community or served epoch.",
      ),
      "/v1/communities/{mint}/leaderboard": get(
        "An epoch's leaderboard, or the all-time one",
        [
          "Members ranked by point units; ties share a rank. Member eligibility checklists are private.",
          "`epoch=all` sums every served epoch per member, in the same shape with `epoch: null`. Its whole points are those of the summed units; its wallets are the signed links valid now; it is closed and final only when every epoch is.",
        ].join("\n\n"),
        ["Leaderboard", "AllTimeLeaderboard"],
        [
          mint,
          query(
            "epoch",
            "The epoch index, or `all`.",
            {
              oneOf: [
                { type: "integer", minimum: 1 },
                { type: "string", const: "all" },
              ],
            },
            true,
          ),
          ...paging,
        ],
        "No such community or served epoch.",
      ),
      "/v1/contributions/{id}": get(
        "A contribution",
        "One contribution with every judgement revision, correction and provenance. Member eligibility checklists are private.",
        "Contribution",
        [path("id", "The contribution id.", { type: "string", format: "uuid" })],
        "No such served contribution.",
      ),
      "/v1/communities/{mint}/epochs/{index}/claims/{wallet}": get(
        "A wallet's claim in an epoch",
        "The leaf, its proof and every address a claim transaction needs. When claimable, a recent blockhash to sign with. Never cached.",
        "Claim",
        [mint, index, wallet],
        "No leaf for this wallet in a published epoch.",
      ),
      "/v1/wallets/{wallet}/claims": get(
        "A wallet's claims",
        "Every leaf of the wallet in a published epoch of any community, newest first, each with its proof and payment status. Claimable entries carry no blockhash: read the epoch's claim route before signing.",
        "WalletClaims",
        [wallet, ...paging],
        null,
      ),
      "/v1/wallets/{wallet}/record": get(
        "A wallet's record",
        [
          "Every epoch, in any community, whose public reads show this wallet for a member: the member's signed link valid at the epoch's close, or now while it is open. Newest first, paged by epoch; the totals cover every epoch.",
          "Per epoch: each contribution with its state, credited quality and exact points (counted: it has a selected judgement; credited: counted above zero; the average is the mean credited quality of the counted contributions, to two decimals), and the payout: the amount allocated to the wallet in the recorded publication, with its payment read against the chain (paid only with the claim transaction), or why there is none.",
          "No contribution link is served here; each contribution's own route has it.",
        ].join("\n\n"),
        "WalletRecord",
        [path("wallet", "A Solana address: base58 for exactly 32 bytes.", base58), ...paging],
        "No epoch's public reads show this wallet.",
      ),
      "/v1/integrations/communities/{mint}/raids": {
        post: {
          summary: "Open a raid from Organic (server to server)",
          description: [
            "Opens a raid for the community as its Telegram /raid would: the same checks (registered community, reward intake open, at most 3 open raids, a public X post the bot can read), the same records and private alerts, and the same announcement in the community's group. The raid opens when Hyphae records it; `opens_at`, if sent, must be within 60 seconds of that (no scheduling). `closes_at` is 1 minute to 30 days later. `actor` is the Organic admin or steward Organic resolved; Hyphae stores it for audit and trusts it only because the request is signed.",
            "Signed with a per-environment shared key: `Authorization: Organic-HMAC keyId=<id>, ts=<unix seconds>, sig=<hex>`, where sig is the lowercase hex HMAC-SHA256, keyed with the secret's UTF-8 bytes, of `<METHOD>\\n<path>\\n<ts>\\n<lowercase hex SHA-256 of the raw body>` (\\n a newline), the path without a query string. `ts` must be within 60 seconds of Hyphae's clock.",
            "Idempotent per community and `idempotency_key`: the same key with the same body (compared as canonical JSON) returns the first answer; with a different body, 409 `idempotency_conflict`; while the first is still being announced, 409 `request_in_progress`. If Telegram refuses the announcement, nothing is kept (503 `telegram_unavailable`) and the same request may be sent again.",
          ].join("\n\n"),
          security: [{ organicHmac: [] }],
          parameters: [mint],
          requestBody: { required: true, content: json("OrganicRaidRequest") },
          responses: {
            "201": {
              description: "The raid as the public raids read shows it.",
              content: json("OrganicRaid"),
            },
            "400": {
              description:
                "A malformed request, or a post, window or opening Hyphae cannot accept.",
              content: json("IntegrationError"),
            },
            "401": {
              description:
                "A missing or wrong signature, or a stale ts: `unauthorized`, `stale_request`.",
              content: json("IntegrationError"),
            },
            "403": {
              description:
                "The mint is not a registered community, or its reward intake is paused.",
              content: json("IntegrationError"),
            },
            "409": {
              description: "3 raids are open, or the idempotency key conflicts or is in progress.",
              content: json("IntegrationError"),
            },
            "413": {
              description: "A body over 16 KiB: `bad_request`.",
              content: json("IntegrationError"),
            },
            "503": {
              description:
                "No key configured (`not_configured`), Telegram unavailable, or the database: `unavailable`.",
              content: json("IntegrationError"),
            },
          },
        },
      },
      "/member/v1/communities/{mint}/me": {
        get: {
          summary: "The signed-in member's own account",
          description: [
            "Who the token's member is in this community: Telegram link, group membership, recorded reward wallet, and `rules_test`: their own pass of the rules test that the community's current rules require (`passed_at` in UTC), or null when those rules have no test.",
            "Never another member's record: the caller is resolved from the token, no selector is accepted, and the answer is never cached.",
          ].join("\n\n"),
          security: [{ memberToken: [] }],
          parameters: [mint],
          responses: {
            "200": { description: "OK", content: json("MemberAccount") },
            "400": {
              description: "A malformed mint or any query string: `invalid_request`.",
              content: json("MemberError"),
            },
            "401": {
              description: "No valid member token: `unauthorized`.",
              content: json("MemberError"),
            },
            "404": {
              description: "No community with this mint: `not_found`.",
              content: json("MemberError"),
            },
            "429": {
              description: "Too many requests: `unavailable`.",
              content: json("MemberError"),
            },
            "503": {
              description: "Not configured, or a provider could not be read: `unavailable`.",
              content: json("MemberError"),
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        organicHmac: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "Organic-HMAC keyId=<id>, ts=<unix seconds>, sig=<hex>; see the route.",
        },
        memberToken: {
          type: "http",
          scheme: "bearer",
          description: "The signed-in member's app token, verified with the identity provider.",
        },
      },
      schemas: Object.fromEntries(
        Object.entries(schemas).map(([name, s]) => [
          name,
          z.toJSONSchema(s, { unrepresentable: "any" }),
        ]),
      ),
      headers: {
        RateLimitPolicy: header("Requests allowed per window, and the window in seconds."),
        RateLimitLimit: header("Requests allowed per window."),
        RateLimitRemaining: header("Requests left in this window."),
        RateLimitReset: header("Seconds until the window resets."),
        RetryAfter: header("Seconds to wait before retrying."),
      },
    },
  };
}
