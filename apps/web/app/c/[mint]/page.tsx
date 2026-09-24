import { notFound } from "next/navigation.js";
import { CommunityView, UnavailableView } from "../../../components/views.js";
import { readCommunity } from "../../../lib/reads.js";

export default async function CommunityPage(props: { params: Promise<{ mint: string }> }) {
  const { mint } = await props.params;
  const r = await readCommunity(mint);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  return <CommunityView community={r.data} />;
}
