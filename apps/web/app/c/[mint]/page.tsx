import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { CommunityView, UnavailableView } from "../../../components/views.js";
import { readCommunity } from "../../../lib/reads.js";

// The same read as the page (Next dedupes it).
export async function generateMetadata(props: {
  params: Promise<{ mint: string }>;
}): Promise<Metadata> {
  const r = await readCommunity((await props.params).mint);
  return { title: r.ok ? r.data.name : "Community" };
}

export default async function CommunityPage(props: { params: Promise<{ mint: string }> }) {
  const { mint } = await props.params;
  const r = await readCommunity(mint);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  return <CommunityView community={r.data} />;
}
