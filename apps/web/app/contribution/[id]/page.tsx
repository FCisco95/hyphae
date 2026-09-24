import { notFound } from "next/navigation.js";
import { ContributionView, UnavailableView } from "../../../components/views.js";
import { readContribution } from "../../../lib/reads.js";

export default async function ContributionPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const r = await readContribution(id);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  return <ContributionView c={r.data} />;
}
