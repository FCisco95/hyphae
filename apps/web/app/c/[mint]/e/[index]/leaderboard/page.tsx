import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { LeaderboardView, UnavailableView } from "../../../../../../components/views.js";
import { readLeaderboard } from "../../../../../../lib/reads.js";

export async function generateMetadata(props: {
  params: Promise<{ index: string }>;
}): Promise<Metadata> {
  return { title: `Leaderboard, epoch ${(await props.params).index}` };
}

export default async function LeaderboardPage(props: {
  params: Promise<{ mint: string; index: string }>;
}) {
  const { mint, index } = await props.params;
  const r = await readLeaderboard(mint, index);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  return <LeaderboardView board={r.data} />;
}
