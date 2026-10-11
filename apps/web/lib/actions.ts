import { getBase64Decoder, isAddress } from "@solana/kit";
import { unavailableSentence } from "../components/views.js";
import { claimTransaction } from "./claim.js";
import { explorerTx, networkName, sol } from "./format.js";
import { readClaim, readEpoch } from "./reads.js";
import { settlementOf } from "./settlement.js";

// The claim as a Solana Action (spec 2.4, https://solana.com/docs/advanced/actions): a blink
// client reads the epoch's payout here and asks for the member's claim transaction. The
// transaction is the claim page's own, built by the same function from the same read; this server
// signs nothing and holds no key.

type Network = "solana:devnet" | "solana:mainnet";
export type ActionReply = { status: number; body: unknown; network?: Network };

// CAIP-2 ids, from the spec's reference SDK.
const CHAIN_ID: Record<Network, string> = {
  "solana:mainnet": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana:devnet": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
};

// The spec's CORS headers, for Action routes and actions.json only: any site may render a blink.
// X-Blockchain-Ids only when the epoch's chain is known; a client that sees none assumes mainnet.
export function actionHeaders(network?: Network): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers":
      "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
    "access-control-expose-headers": "X-Action-Version, X-Blockchain-Ids",
    "x-action-version": "2.4",
    "cache-control": "no-store",
    ...(network ? { "x-blockchain-ids": CHAIN_ID[network] } : {}),
  };
}

// The API's own path rules, checked here so a malformed link reads nothing.
const MINT = /^[A-Za-z0-9]{1,64}$/;
const INDEX = /^[1-9]\d{0,8}$/;
const MAX_BODY = 1024;

const fail = (status: number, message: string, network?: Network): ActionReply => ({
  status,
  body: { message },
  network,
});
const TOO_LARGE = fail(413, "That request is too large.");
const NOT_JSON = fail(415, "Send the request as JSON.");
const BODY_FAILED = fail(400, "That request could not be read. Try again.");
const NOT_A_LINK = fail(400, "This is not a Hyphae claim link.");
const NO_WALLET = fail(400, "Connect a Solana wallet to claim.");
const UNREADABLE_MESSAGE = "Hyphae can't be read right now. Try again in a minute.";
const UNREADABLE = fail(503, UNREADABLE_MESSAGE);

async function epochOf(mint: string, index: string) {
  const r = await readEpoch(mint, index);
  if (!r.ok) {
    return {
      reply: r.reason === "not_found" ? fail(404, "This epoch does not exist.") : UNREADABLE,
    };
  }
  return { epoch: r.data, allocation: settlementOf(r.data).allocation };
}

export async function claimAction(
  mint: string,
  index: string,
  origin: string,
): Promise<ActionReply> {
  if (!MINT.test(mint) || !INDEX.test(index)) return NOT_A_LINK;
  const read = await epochOf(mint, index);
  if (read.reply) return read.reply;
  const { epoch, allocation: a } = read;
  const head = {
    type: "action",
    icon: `${origin}/brand/hyphae-mark.svg`,
    title: `Claim · ${epoch.community.name} · Epoch ${epoch.index}`,
    label: "Claim",
  };
  if (a.status !== "published") {
    return {
      status: 200,
      body: { ...head, description: unavailableSentence(a.reason), disabled: true },
    };
  }
  return {
    status: 200,
    network: a.network,
    body: {
      ...head,
      description: `${sol(a.allocated_lamports)} to ${a.payable_members} members, published on ${networkName(a.network)}. Use the wallet you verified with the bot; it signs and pays for its own claim.`,
      links: {
        actions: [
          { type: "transaction", label: "Claim", href: `/api/actions/claim/${mint}/${index}` },
        ],
      },
    },
  };
}

const JSON_TYPE = /^application\/json\s*(;\s*charset=("?)utf-8\2\s*)?$/i;

// Counts bytes as they arrive and cancels the stream at the limit, so an oversized body is never
// buffered whole. A body that fails mid-read gets an Action error like any other bad request.
async function readBody(request: Request): Promise<string | ActionReply> {
  if (!JSON_TYPE.test(request.headers.get("content-type") ?? "")) return NOT_JSON;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel().catch(() => {});
        return TOO_LARGE;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch {
    return BODY_FAILED;
  }
}

function accountOf(raw: string): string | null {
  try {
    const body: unknown = JSON.parse(raw);
    if (typeof body !== "object" || body === null || !("account" in body)) return null;
    const { account } = body;
    return typeof account === "string" && isAddress(account) ? account : null;
  } catch {
    return null;
  }
}

export async function claimPost(
  mint: string,
  index: string,
  request: Request,
  visitor: string | null,
): Promise<ActionReply> {
  if (!MINT.test(mint) || !INDEX.test(index)) return NOT_A_LINK;
  const raw = await readBody(request);
  if (typeof raw !== "string") return raw;
  const account = accountOf(raw);
  if (!account) return NO_WALLET;
  const read = await epochOf(mint, index);
  if (read.reply) return read.reply;
  const { epoch, allocation: a } = read;
  if (a.status !== "published") return fail(409, unavailableSentence(a.reason));

  const r = await readClaim(mint, index, account, visitor);
  if (!r.ok) {
    return r.reason === "not_found"
      ? fail(
          404,
          `This wallet has no payout in epoch ${epoch.index}. Use the wallet you verified with the bot.`,
          a.network,
        )
      : fail(503, UNREADABLE_MESSAGE, a.network);
  }
  const claim = r.data;
  const p = claim.payment;
  if (p.status === "paid") {
    return fail(
      409,
      `This wallet already claimed epoch ${epoch.index}. Transaction: ${explorerTx(p.claim_tx, claim.network)}`,
      claim.network,
    );
  }
  if (p.status === "unavailable") return fail(503, unavailableSentence(p.reason), claim.network);

  let transaction: Uint8Array;
  try {
    transaction = await claimTransaction(claim, account);
  } catch (error) {
    console.error(
      JSON.stringify({ web: "action claim refused", mint, index, error: String(error) }),
    );
    return fail(
      503,
      "This claim can't be checked right now, so nothing was built. Try again in a minute.",
      claim.network,
    );
  }
  return {
    status: 200,
    network: claim.network,
    body: {
      type: "transaction",
      transaction: getBase64Decoder().decode(transaction),
      message: `Claim ${sol(claim.amount_lamports)} from ${epoch.community.name}, epoch ${epoch.index}. Your wallet pays the network fee and the claim receipt's rent.`,
    },
  };
}
