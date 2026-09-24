import { notFound } from "next/navigation.js";
import { EpochView, UnavailableView } from "../../../../../components/views.js";
import { readContributions, readEpoch } from "../../../../../lib/reads.js";

export default async function EpochPage(props: {
  params: Promise<{ mint: string; index: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { mint, index } = await props.params;
  const { offset } = await props.searchParams;
  const start = /^\d{1,9}$/.test(offset ?? "") ? Number(offset) : 0;
  const [epoch, list] = await Promise.all([
    readEpoch(mint, index),
    readContributions(mint, index, start),
  ]);
  if (!epoch.ok && epoch.reason === "not_found") notFound();
  if (!epoch.ok || !list.ok) return <UnavailableView />;
  return <EpochView epoch={epoch.data} list={list.data} />;
}
