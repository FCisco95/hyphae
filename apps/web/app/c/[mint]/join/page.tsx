import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { JoinView } from "../../../../components/community.js";
import { UnavailableView } from "../../../../components/views.js";
import { communityPresentation } from "../../../../lib/community-presentation.js";
import { readCommunity } from "../../../../lib/reads.js";

export async function generateMetadata(props: {
  params: Promise<{ mint: string }>;
}): Promise<Metadata> {
  const r = await readCommunity((await props.params).mint);
  return { title: r.ok ? `Join ${r.data.name}` : "Join community" };
}

export default async function JoinPage(props: { params: Promise<{ mint: string }> }) {
  const r = await readCommunity((await props.params).mint);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  return <JoinView community={r.data} presentation={communityPresentation(r.data.mint)} />;
}
