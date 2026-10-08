import { ReadApiV1 } from "@hyphae/core";
import { z } from "zod";

// The v1 contract as OpenAPI 3.1. Every schema is generated from the zod schemas the api's own
// tests parse its responses with, so the document cannot drift from what the api serves; a test
// checks that every served route is documented.

const schemas = {
  Community: ReadApiV1.community,
  Epoch: ReadApiV1.epoch,
  Contributions: ReadApiV1.contributions,
  Leaderboard: ReadApiV1.leaderboard,
  Contribution: ReadApiV1.contribution,
  Claim: ReadApiV1.claim,
  WalletClaims: ReadApiV1.walletClaims,
  Error: ReadApiV1.error,
};

const ref = (name: keyof typeof schemas) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: keyof typeof schemas) => ({ "application/json": { schema: ref(name) } });

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
  body: keyof typeof schemas,
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
        "Public, read-only and unauthenticated. JSON in snake_case. Exact integers (point units,",
        "lamports) are decimal strings; timestamps are RFC 3339 UTC with microseconds.",
        "",
        "A section the api cannot confirm is `{ status: 'unavailable', reason }`, never a zero.",
        "Settlement and payment are read against Solana: a transaction is shown only when the",
        "chain proves it created the account it names.",
        "",
        "Inside v1 fields are only added. Parse loosely: an older api may lack a newer field.",
      ].join("\n"),
    },
    paths: {
      "/v1/communities/{mint}": get(
        "A community",
        "Its name, current epoch and every served epoch.",
        "Community",
        [mint],
        "No community with this mint.",
      ),
      "/v1/communities/{mint}/epochs/{index}": get(
        "An epoch",
        "Window, status, pinned configuration, counts, the frozen snapshot, and the settlement: the published allocation and each member's payment, read against the chain.",
        "Epoch",
        [mint, index],
        "No such community or served epoch.",
      ),
      "/v1/communities/{mint}/epochs/{index}/contributions": get(
        "An epoch's contributions",
        "Audit rows in intake order, each with its selected judgement and its member's payout status: what the payout gate would decide as of the read (the hold is read only after the close).",
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
        "An epoch's leaderboard",
        "Members ranked by point units; ties share a rank. Each with its payout status.",
        "Leaderboard",
        [
          mint,
          query("epoch", "The epoch index.", { type: "integer", minimum: 1 }, true),
          ...paging,
        ],
        "No such community or served epoch.",
      ),
      "/v1/contributions/{id}": get(
        "A contribution",
        "One contribution with every judgement revision, correction and provenance, and its member's payout status.",
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
    },
    components: {
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
