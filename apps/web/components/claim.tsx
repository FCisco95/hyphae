import type { ClaimV1, LooseEpochV1 } from "@hyphae/core";
import { networkName, shortWallet, sol } from "../lib/format.js";
import { walletPath } from "../lib/record.js";
import { settlementOf } from "../lib/settlement.js";
import { ClaimPanel } from "./claim-panel.js";
import { Panel, Stat, Stats } from "./ui.js";
import { Tx, unavailableSentence } from "./views.js";

// What the wallet will be asked to sign, shown before it signs.
export function ClaimSummary({ claim }: { claim: ClaimV1 }) {
  const p = claim.payment;
  return (
    <Panel title={sol(claim.amount_lamports)}>
      <Stats compact>
        <Stat label="Epoch" value={claim.epoch.index} />
        <Stat label="Network" value={networkName(claim.network)} />
        <Stat
          label="Wallet"
          value={
            <a className="mono" href={walletPath(claim.wallet)} title={claim.wallet}>
              {shortWallet(claim.wallet)}
            </a>
          }
        />
        <Stat
          label="Program"
          value={
            <span className="mono" title={claim.program_id}>
              {shortWallet(claim.program_id)}
            </span>
          }
        />
        <Stat
          label="Status"
          value={
            p.status === "paid" ? (
              <span className="paid">
                Paid in <Tx signature={p.claim_tx} network={claim.network} />
              </span>
            ) : p.status === "claimable" ? (
              "Claimable"
            ) : (
              unavailableSentence(p.reason)
            )
          }
        />
      </Stats>
      {p.status === "claimable" && (
        <p className="muted">
          Your wallet pays the network fee and the claim receipt's rent, and signs. The program pays{" "}
          {sol(claim.amount_lamports)} from the community vault and refuses a second claim.
        </p>
      )}
    </Panel>
  );
}

export function ClaimView({ epoch }: { epoch: LooseEpochV1 }) {
  const a = settlementOf(epoch).allocation;
  const epochPage = `/c/${epoch.community.mint}/e/${epoch.index}`;
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">
          <a href={epochPage}>
            {epoch.community.name} · Epoch {epoch.index}
          </a>
        </p>
        <h1>Claim · Epoch {epoch.index}</h1>
        {a.status === "published" && (
          <p className="muted">
            Published on {networkName(a.network)}. Use the wallet you verified with the bot; it
            signs and pays for its own claim.
          </p>
        )}
      </header>
      {a.status === "published" ? (
        <ClaimPanel mint={epoch.community.mint} index={epoch.index} />
      ) : (
        <p className="banner">{unavailableSentence(a.reason)}</p>
      )}
    </>
  );
}
