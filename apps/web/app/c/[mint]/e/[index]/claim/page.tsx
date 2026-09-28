import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { ClaimView } from "../../../../../../components/claim.js";
import { UnavailableView } from "../../../../../../components/views.js";
import { readEpoch } from "../../../../../../lib/reads.js";

export async function generateMetadata(props: {
  params: Promise<{ index: string }>;
}): Promise<Metadata> {
  return { title: `Claim, epoch ${(await props.params).index}` };
}

export default async function ClaimPage(props: {
  params: Promise<{ mint: string; index: string }>;
}) {
  const { mint, index } = await props.params;
  const epoch = await readEpoch(mint, index);
  if (!epoch.ok && epoch.reason === "not_found") notFound();
  if (!epoch.ok) return <UnavailableView />;
  return <ClaimView epoch={epoch.data} />;
}
