import type { CommunityStatsV1, CommunityV1 } from "@hyphae/core";
import { sol } from "../lib/format.js";
import { Stat, Stats } from "./ui.js";

// The community's totals at the top of its page, with the way to fund it. Money figures are the
// chain's: when the api could not confirm them they say so, and the counts, which are the
// database's, still show.
export function StatsStrip({
  stats,
  vault,
}: {
  stats: CommunityStatsV1;
  vault: CommunityV1["vault"];
}) {
  const { payouts, members, epochs } = stats;
  const money = (lamports: string) =>
    payouts.status === "available" ? sol(lamports) : "Not confirmed";
  const note = payouts.status === "available" ? undefined : "Solana cannot be read right now";
  return (
    <section className="stats-strip" aria-labelledby="stats-title">
      <div className="stats-strip-head">
        <h2 id="stats-title">At a glance</h2>
        <a className="button" href="#treasury">
          {vault?.status === "available" ? "Fund this community" : "See the treasury"}
        </a>
      </div>
      <Stats>
        <Stat
          label="Paid to members"
          value={money(payouts.status === "available" ? payouts.claimed_lamports : "0")}
          {...(note ? { note } : {})}
        />
        <Stat
          label="Waiting to be claimed"
          value={money(payouts.status === "available" ? payouts.unclaimed_lamports : "0")}
        />
        <Stat
          label="Epochs paid"
          value={payouts.status === "available" ? String(payouts.epochs_paid) : "Not confirmed"}
          note={`of ${epochs.served}`}
        />
        <Stat label="Members who earned points" value={String(members.ever_scored)} />
        <Stat label="Registered members" value={String(members.registered)} />
      </Stats>
    </section>
  );
}
