import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { AboutView } from "../../../../components/community.js";
import { UnavailableView } from "../../../../components/views.js";
import { communityPresentation } from "../../../../lib/community-presentation.js";
import { readCommunity } from "../../../../lib/reads.js";

export async function generateMetadata(props: {
  params: Promise<{ mint: string }>;
}): Promise<Metadata> {
  const r = await readCommunity((await props.params).mint);
  return { title: r.ok ? `About ${r.data.name}` : "Project context" };
}

export default async function AboutPage(props: { params: Promise<{ mint: string }> }) {
  const r = await readCommunity((await props.params).mint);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  return <AboutView community={r.data} presentation={communityPresentation(r.data.mint)} />;
}
