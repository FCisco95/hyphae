import { Suspense } from "react";
import { Hero, HowItWorks, Integrate, Proof, Trust } from "../components/landing.js";
import { loadLiveProof } from "../lib/landing.js";
import { readCommunity, readEpoch } from "../lib/reads.js";

// Read DEFAULT_MINT and the live numbers per request, not once at build time.
export const dynamic = "force-dynamic";

async function LiveProof({ mint }: { mint: string | undefined }) {
  const live = await loadLiveProof(mint, readCommunity, (m, index) => readEpoch(m, String(index)));
  return <Proof live={live} />;
}

// The hero never waits on the API; only the proof section does.
export default function Home() {
  const mint = process.env.DEFAULT_MINT;
  return (
    <div className="landing">
      <Hero communityHref={mint ? `/c/${mint}` : "/community"} />
      <HowItWorks />
      <Suspense fallback={<Proof live={{ state: "loading" }} />}>
        <LiveProof mint={mint} />
      </Suspense>
      <Trust />
      <Integrate />
    </div>
  );
}
