import type { CommunityStatsV1, CommunityV1 } from "@hyphae/core";
import { explorerAddress, explorerTx, networkName, shortWallet, sol, utc } from "../lib/format.js";
import { FundPanel } from "./fund.js";
import { EvidenceLink, Panel, Stat, Stats } from "./ui.js";

type Network = "solana:devnet" | "solana:mainnet";

// Every figure here is the chain's, read by the api; the explorer links let anyone check each one.
// The addresses and totals appear only where the api confirmed them.
export function TreasuryPanel({
  vault,
  stats,
}: {
  vault: NonNullable<CommunityV1["vault"]>;
  stats: CommunityStatsV1;
}) {
  const payouts = stats.payouts;
  const network: Network | null =
    vault.status === "available"
      ? vault.network
      : payouts.status === "available"
        ? payouts.network
        : null;
  return (
    <section id="treasury" className="treasury" aria-labelledby="treasury-title">
      <div className="community-section-head">
        <p className="eyebrow">Treasury</p>
        <h2 id="treasury-title">The community's money, from Solana.</h2>
        <p className="muted">
          Read from Solana, not from our database. Open any address or transaction to check it
          yourself.
        </p>
      </div>
      <FundPanel vault={vault} />
      {payouts.status === "unavailable" ? (
        <Panel title="Payouts">
          <p className="banner">
            Payout totals cannot be confirmed on Solana right now. Nothing here is a zero.
          </p>
        </Panel>
      ) : (
        <Panel title="Payouts">
          <Stats compact>
            <Stat label="Pots published" value={sol(payouts.gross_lamports)} />
            <Stat label="Fees" value={sol(payouts.fee_lamports)} />
            <Stat label="Allocated to members" value={sol(payouts.allocated_lamports)} />
            <Stat label="Claimed" value={sol(payouts.claimed_lamports)} />
            <Stat label="Unclaimed" value={sol(payouts.unclaimed_lamports)} />
            <Stat
              label="Program"
              value={
                network ? (
                  <EvidenceLink
                    href={explorerAddress(payouts.program_id, network)}
                    value={payouts.program_id}
                    shown={shortWallet(payouts.program_id)}
                    network={networkName(network)}
                  />
                ) : (
                  <span className="mono" title={payouts.program_id}>
                    {shortWallet(payouts.program_id)}
                  </span>
                )
              }
            />
          </Stats>
          {payouts.publications.length === 0 || !network ? (
            <p className="empty">No epoch has been published yet.</p>
          ) : (
            <table className="stack">
              <thead>
                <tr>
                  <th>Epoch</th>
                  <th>Published</th>
                  <th>Transaction</th>
                  <th>Root</th>
                  <th>Claimed</th>
                </tr>
              </thead>
              <tbody>
                {payouts.publications.map((p) => (
                  <tr key={p.epoch_address}>
                    <td data-label="Epoch">
                      <a href={`/c/${stats.community.mint}/e/${p.index}`}>Epoch {p.index}</a>
                    </td>
                    <td data-label="Published">{utc(p.published_at)}</td>
                    <td data-label="Transaction">
                      <EvidenceLink
                        href={explorerTx(p.publish_tx, network)}
                        value={p.publish_tx}
                        shown={shortWallet(p.publish_tx)}
                      />
                    </td>
                    <td data-label="Root">
                      <EvidenceLink
                        href={explorerAddress(p.epoch_address, network)}
                        value={p.root}
                        shown={`${p.root.slice(0, 12)}…`}
                      />
                    </td>
                    <td data-label="Claimed">
                      {sol(p.claimed_lamports)} of {sol(p.allocated_lamports)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="small muted">
            Data as of {utc(stats.as_of)}. The root is the epoch account's payout commitment; its
            link opens that account.
          </p>
        </Panel>
      )}
    </section>
  );
}
