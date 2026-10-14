import { card } from "../../../../../../components/og.js";
import { raidCard } from "../../../../../../lib/cards.js";
import { readRaids } from "../../../../../../lib/reads.js";

// The picture the bot uploads with a new raid's card: the post, from public data only. The bot
// asks as a raid opens, so the list is read fresh: a cached one would not have the raid yet.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mint: string; taskId: string }> },
) {
  const { mint, taskId } = await params;
  const raids = await readRaids(mint, { fresh: true });
  if (!raids.ok) {
    return raids.reason === "not_found"
      ? new Response("No such raid", { status: 404 })
      : new Response("Raids unavailable", { status: 503 });
  }
  const view = raidCard(raids.data.raids.find((r) => r.id === taskId));
  return view ? card(view) : new Response("No such raid", { status: 404 });
}
