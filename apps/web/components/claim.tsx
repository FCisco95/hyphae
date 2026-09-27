import type { ClaimV1, LooseEpochV1 } from "@hyphae/core";
import { networkName, shortWallet, sol } from "../lib/format.js";
import { settlementOf } from "../lib/settlement.js";
import { ClaimPanel } from "./claim-panel.js";
import { Tx, unavailableSentence } from "./views.js";

// What the wallet will be asked to sign, shown before it signs.
export function ClaimSummary({ claim }: { claim: ClaimV1 }) {
  const p = claim.payment;
  return (
    <section className="panel">
      <h2>{sol(claim.amount_lamports)}</h2>
      <dl className="facts">
        <div>
          <dt>Epoch</dt>
          <dd>{claim.epoch.index}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{networkName(claim.network)}</dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd className="mono" title={claim.wallet}>
            {shortWallet(claim.wallet)}
          </dd>
        </div>
        <div>
          <dt>Program</dt>
          <dd className="mono" title={claim.program_id}>
            {shortWallet(claim.program_id)}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            {p.status === "paid" ? (
              <>
                Paid in <Tx signature={p.claim_tx} network={claim.network} />
              </>
            ) : p.status === "claimable" ? (
              "Claimable"
            ) : (
              unavailableSentence(p.reason)
            )}
          </dd>
        </div>
      </dl>
      {p.status === "claimable" && (
        <p className="muted">
          Your wallet pays the network fee and the claim receipt's rent, and signs. The program pays{" "}
          {sol(claim.amount_lamports)} from the community vault and refuses a second claim.
        </p>
      )}
    </section>
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
