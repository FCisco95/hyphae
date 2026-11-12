import {
  type CommunityV1,
  communityAddress,
  decodeCommunity,
  HYPHAE_PROGRAM_ID,
  vaultAddress,
} from "@hyphae/core";
import { address, getAddressDecoder } from "@solana/kit";
import { byDeadline, type SettlementReader } from "./settlement.js";

type Vault = CommunityV1["vault"];
const unavailable = (reason: string): Vault => ({ status: "unavailable", reason });
const toAddress = (bytes: Uint8Array) => getAddressDecoder().decode(bytes);

// Where to fund a community, before any epoch is published: its vault address, read from the
// community account the operator bound it to, with the vault's balance and what published epochs
// still owe. The account must be this mint's community at the address its admin derives.
export async function readVault(
  community: { mint: string; chainAddress: string | null },
  reader: SettlementReader | undefined,
  until: number,
): Promise<Vault> {
  if (!reader) return unavailable("chain_unconfigured");
  const bound = community.chainAddress;
  if (!bound) return unavailable("community_not_on_chain");
  const work = (async (): Promise<Vault> => {
    const [network, [data]] = await Promise.all([
      reader.network(),
      reader.accounts(HYPHAE_PROGRAM_ID, [bound]),
    ]);
    if (!data) return unavailable("community_not_on_chain");
    const onChain = decodeCommunity(data);
    const admin = toAddress(onChain.admin);
    const derived = await communityAddress(HYPHAE_PROGRAM_ID, address(community.mint), admin);
    if (toAddress(onChain.mint) !== community.mint || derived !== bound) {
      return unavailable("chain_mismatch");
    }
    const vault = await vaultAddress(HYPHAE_PROGRAM_ID, derived);
    const [balance, rent] = await Promise.all([
      reader.balance(vault),
      // Rent is the one figure that may fail alone: the vault and its balance are still true.
      reader.rentExempt ? reader.rentExempt(vault).catch(() => null) : null,
    ]);
    // The program's own rule (publish_epoch, P6): balance less rent less what is still owed.
    const free = rent === null ? null : balance - rent - onChain.outstandingLamports;
    return {
      status: "available",
      network,
      program_id: HYPHAE_PROGRAM_ID,
      community_address: derived,
      vault_address: vault,
      admin,
      fee_recipient: toAddress(onChain.feeRecipient),
      balance_lamports: String(balance),
      outstanding_lamports: String(onChain.outstandingLamports),
      rent_lamports: rent === null ? null : String(rent),
      unassigned_lamports: free === null || free < 0n ? null : String(free),
    };
  })().catch(() => unavailable("chain_unavailable"));
  return byDeadline(work, until, unavailable("chain_unavailable"));
}
