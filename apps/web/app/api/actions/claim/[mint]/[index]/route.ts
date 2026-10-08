import {
  type ActionReply,
  actionHeaders,
  claimAction,
  claimPost,
} from "../../../../../../lib/actions.js";

// The epoch's claim as a Solana Action. Never cached: the leaf's blockhash expires in about a
// minute and its paid status changes with a claim.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ mint: string; index: string }> };

const send = (r: ActionReply) =>
  Response.json(r.body, { status: r.status, headers: actionHeaders(r.network) });

export async function GET(request: Request, context: Context) {
  const { mint, index } = await context.params;
  return send(await claimAction(mint, index, new URL(request.url).origin));
}

export async function POST(request: Request, context: Context) {
  const { mint, index } = await context.params;
  // Vercel sets x-real-ip to the caller's address and overwrites whatever the caller sent.
  return send(await claimPost(mint, index, await request.text(), request.headers.get("x-real-ip")));
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: actionHeaders() });
}
