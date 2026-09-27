import { notFound, redirect } from "next/navigation.js";
import { UnavailableView } from "../../components/views.js";
import { readCommunity, readEpoch } from "../../lib/reads.js";

// Read DEFAULT_MINT per request, not once at build time.
export const dynamic = "force-dynamic";

// The default community's latest published epoch, where a member claims.
export default async function Claim() {
  const mint = process.env.DEFAULT_MINT;
  if (!mint) return <p className="empty">No community is configured.</p>;
  const community = await readCommunity(mint);
  if (!community.ok) return community.reason === "not_found" ? notFound() : <UnavailableView />;
  // Newest first; a published epoch is closed, and only a few are ever checked.
  const closed = community.data.epochs.filter((e) => e.status === "closed").slice(0, 5);
  for (const e of closed) {
    const epoch = await readEpoch(mint, String(e.index));
    if (epoch.ok && epoch.data.allocation.status === "published") {
      redirect(`/c/${mint}/e/${e.index}/claim`);
    }
  }
  return <p className="banner">No epoch has been published yet, so there is nothing to claim.</p>;
}
