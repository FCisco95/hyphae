import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { ShareClaim } from "../../../components/claim.js";
import { ContributionView, UnavailableView } from "../../../components/views.js";
import { contributionCard } from "../../../lib/cards.js";
import { readContribution, readEpoch } from "../../../lib/reads.js";

type Props = { params: Promise<{ id: string }> };

// The same read as the page (Next dedupes it): the score as the title, where it was made below.
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const r = await readContribution(id);
  const { context, title } = contributionCard(r);
  return {
    title,
    description: r.ok ? `${context}. Every revision and its reasoning, on Hyphae.` : title,
  };
}

export default async function ContributionPage(props: Props) {
  const { id } = await props.params;
  const r = await readContribution(id);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  // Only for the share link: a failed read leaves the receipt as it is.
  const epoch = await readEpoch(r.data.community.mint, String(r.data.epoch.index));
  return (
    <>
      <ContributionView c={r.data} />
      {epoch.ok && <ShareClaim epoch={epoch.data} />}
    </>
  );
}
