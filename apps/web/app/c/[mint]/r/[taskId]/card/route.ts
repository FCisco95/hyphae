import { card } from "../../../../../../components/og.js";
import { raidCard } from "../../../../../../lib/cards.js";
import { readRaids } from "../../../../../../lib/reads.js";

// The picture the bot uploads with a new raid's card: the post, from public data only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mint: string; taskId: string }> },
) {
  const { mint, taskId } = await params;
  const raids = await readRaids(mint);
  if (!raids.ok) return new Response("Raids unavailable", { status: 503 });
  const view = raidCard(raids.data.raids.find((r) => r.id === taskId));
  return view ? card(view) : new Response("No such raid", { status: 404 });
}
