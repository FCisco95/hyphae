import { readClaim } from "../../../../../../lib/reads.js";

// The claim page's same-origin read of one wallet's leaf. Never cached: the leaf's blockhash
// expires in about a minute and its paid status changes with a claim.
export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ mint: string; index: string; wallet: string }> },
) {
  const { mint, index, wallet } = await context.params;
  const r = await readClaim(mint, index, wallet);
  if (r.ok) return Response.json(r.data, { headers });
  return Response.json(
    { error: r.reason },
    { status: r.reason === "not_found" ? 404 : 503, headers },
  );
}
