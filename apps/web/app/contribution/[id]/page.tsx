import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { ContributionView, UnavailableView } from "../../../components/views.js";
import { contributionCard } from "../../../lib/cards.js";
import { readContribution } from "../../../lib/reads.js";

type Props = { params: Promise<{ id: string }> };

// The same read as the page (Next dedupes it): the score as the title, where it was made below.
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const r = await readContribution(id);
  const { context, title } = contributionCard(r.ok ? r.data : null);
  return { title, description: `${context}. Every revision and its reasoning, on Hyphae.` };
}

export default async function ContributionPage(props: Props) {
  const { id } = await props.params;
  const r = await readContribution(id);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  return <ContributionView c={r.data} />;
}
