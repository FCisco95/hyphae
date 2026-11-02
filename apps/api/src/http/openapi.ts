import { PublicRaidsSchema, ReadApiV1 } from "@hyphae/core";
import { z } from "zod";
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
      "/v1/communities/{mint}/raids": get(
        "A community's raids",
        "Up to 20 active or scheduled raids, earliest deadline first, and up to 6 recent closed or cancelled raids. Approved records only; safe X links and recorded post text, no private member or moderation metadata. Scheduled and cancelled raids omit post content and briefs. Truncated text ends with an ellipsis. A raid window never extends the reward epoch deadline.",
        "Raids",
        [mint],
        "No community with this mint.",
      ),
      "/v1/communities/{mint}/epochs/{index}": get(
        "An epoch",
        [
          "Window, status, pinned configuration, counts, the frozen snapshot, and the settlement: the published allocation and each member's payment, read against the chain.",
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
