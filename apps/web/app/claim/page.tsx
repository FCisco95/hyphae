import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation.js";
import { UnavailableView } from "../../components/views.js";
import { readCommunity, readEpoch } from "../../lib/reads.js";
import { claimTarget } from "../../lib/settlement.js";

export const metadata: Metadata = { title: "Claim" };

// Read DEFAULT_MINT per request, not once at build time.
export const dynamic = "force-dynamic";

// The default community's latest published epoch, where a member claims.
export default async function Claim() {
  const mint = process.env.DEFAULT_MINT;
  if (!mint) return <p className="empty">No community is configured.</p>;
  const community = await readCommunity(mint);
  if (!community.ok) return community.reason === "not_found" ? notFound() : <UnavailableView />;
  // The community lists its epochs newest first.
  const closed = community.data.epochs.filter((e) => e.status === "closed").map((e) => e.index);
  const target = await claimTarget(closed, (index) => readEpoch(mint, String(index)));
  if (target === "unavailable") return <UnavailableView />;
  if (target === "none") {
    return (
      <>
        <header className="page-head">
          <h1>Claim</h1>
        </header>
        <p className="banner">No epoch has been published yet, so there is nothing to claim.</p>
      </>
    );
  }
  redirect(`/c/${mint}/e/${target.index}/claim`);
}
