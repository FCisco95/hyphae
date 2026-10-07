import type { CommunityV1 } from "@hyphae/core";
import { explorerAddress, networkName, shortWallet, sol } from "../lib/format.js";
import { EvidenceLink, Panel, Stat, Stats } from "./ui.js";

// Where to fund the community, read from its account on Solana. Until the chain confirms it there
// is no address to show, and the page says not to send anything.
export function FundPanel({ vault }: { vault: NonNullable<CommunityV1["vault"]> }) {
  if (vault.status === "unavailable") {
    return (
      <Panel title="Fund this community">
        <p className="banner">
          {vault.reason === "community_not_on_chain"
            ? "This community is not on Solana yet, so it has no vault to fund."
            : "The vault cannot be confirmed right now."}{" "}
          Do not send SOL to any address until the vault appears here.
        </p>
      </Panel>
    );
  }
  const network = networkName(vault.network);
  return (
    <Panel title="Fund this community">
      <Stats compact>
        <Stat
          label="Vault"
          value={
            <EvidenceLink
              href={explorerAddress(vault.vault_address, vault.network)}
              value={vault.vault_address}
              network={network}
            />
          }
        />
        <Stat label="Balance" value={sol(vault.balance_lamports)} />
        <Stat label="Owed to published epochs" value={sol(vault.outstanding_lamports)} />
        <Stat
          label="Fee recipient"
          value={
            <EvidenceLink
              href={explorerAddress(vault.fee_recipient, vault.network)}
              value={vault.fee_recipient}
              shown={shortWallet(vault.fee_recipient)}
            />
          }
        />
      </Stats>
      <p>
        Anyone can fund the vault with an ordinary SOL transfer to this address on {network}. SOL
        leaves it only through the program: member claims of a published epoch, and the 3% fee when
        an epoch is published. <a href="/security#admin">What the admin can and cannot do</a>.
      </p>
    </Panel>
  );
}
