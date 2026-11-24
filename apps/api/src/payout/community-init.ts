import {
  communityAddress,
  decodeCommunity,
  initializeCommunityInstruction,
  vaultAddress,
} from "@hyphae/core";
import {
  type Address,
  address,
  getAddressDecoder,
  getAddressEncoder,
  type Instruction,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from "@solana/kit";
import { programAccount } from "./chain.js";

// A community's one-time on-chain setup, shared by `scripts/init-community.ts` and the operator
// page (roadmap item 3 part B): what the admin key derives, what the chain already holds, and the
// one initialize_community instruction. Reads only; it writes no database. Binding
// communities.chain_address stays the operator's own step (bind-community).

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

// The fee address is permanent: the program has no instruction to change it. Only an existing,
// System-owned wallet account is taken, so a typo, a program, or a program-owned account such as a
// Squads multisig account (whose vault is the address to pass) is refused before anything is signed.
export function feeRecipientProblem(
  account: { owner: string; executable: boolean; dataLength: number; lamports: bigint } | null,
): string | null {
  if (!account) return "the fee recipient does not exist on this network";
  if (account.owner !== SYSTEM_PROGRAM) {
    return `the fee recipient is owned by ${account.owner}, not the System program: pass a wallet or a Squads vault, never a multisig account`;
  }
  if (account.executable || account.dataLength !== 0) {
    return "the fee recipient is a program or holds data, not a wallet";
  }
  return null;
}

// 8-byte discriminators; Community holds mint, admin and fee recipient, a u64 and two bumps.
const COMMUNITY_BYTES = 8 + 32 * 3 + 8 + 2;
const VAULT_BYTES = 8 + 1;

export interface InitTarget {
  programId: Address;
  admin: string;
  mint: string;
  feeRecipient: string;
}

export type InitPlan =
  | { status: "refused"; reason: "program_missing" | "fee_recipient_invalid"; detail: string }
  | {
      // Already initialized: what the chain holds. The caller decides what that means.
      status: "exists";
      community: Address;
      vault: Address;
      onChain: { mint: string; admin: string; feeRecipient: string; outstandingLamports: bigint };
    }
  | {
      status: "ready";
      community: Address;
      vault: Address;
      // Rent the admin pays for the community and vault accounts, plus the transaction fee.
      rentLamports: bigint;
      adminLamports: bigint;
    };

export async function planCommunityInit(
  rpc: Rpc<SolanaRpcApi>,
  target: InitTarget,
): Promise<InitPlan> {
  const { programId } = target;
  const community = await communityAddress(programId, address(target.mint), address(target.admin));
  const vault = await vaultAddress(programId, community);
  const account = async (at: Address) =>
    (await rpc.getAccountInfo(at, { encoding: "base64", commitment: "confirmed" }).send()).value;

  if (!(await account(programId))?.executable) {
    return {
      status: "refused",
      reason: "program_missing",
      detail: `the program ${programId} is not deployed on this network`,
    };
  }
  const data = programAccount(programId, await account(community));
  if (data) {
    const c = decodeCommunity(data);
    const decode = getAddressDecoder();
    return {
      status: "exists",
      community,
      vault,
      onChain: {
        mint: decode.decode(c.mint),
        admin: decode.decode(c.admin),
        feeRecipient: decode.decode(c.feeRecipient),
        outstandingLamports: c.outstandingLamports,
      },
    };
  }
  const recipient = await account(address(target.feeRecipient));
  const problem = feeRecipientProblem(
    recipient && {
      owner: recipient.owner,
      executable: recipient.executable,
      dataLength: Buffer.from(recipient.data[0], "base64").length,
      lamports: recipient.lamports,
    },
  );
  if (problem) return { status: "refused", reason: "fee_recipient_invalid", detail: problem };
  const rentFor = (bytes: number) => rpc.getMinimumBalanceForRentExemption(BigInt(bytes)).send();
  const rentLamports = (await rentFor(COMMUNITY_BYTES)) + (await rentFor(VAULT_BYTES));
  const adminLamports = (
    await rpc.getBalance(address(target.admin), { commitment: "confirmed" }).send()
  ).value;
  return { status: "ready", community, vault, rentLamports, adminLamports };
}

// The one instruction init sends: initialize_community, signed and paid for by the admin.
export async function initInstructions(
  target: InitTarget,
  admin: TransactionSigner,
): Promise<Instruction[]> {
  if (admin.address !== target.admin) throw new Error("init: the signer is not the named admin");
  const community = await communityAddress(target.programId, address(target.mint), admin.address);
  return [
    initializeCommunityInstruction({
      programId: target.programId,
      admin,
      mint: address(target.mint),
      community,
      vault: await vaultAddress(target.programId, community),
      feeRecipient: new Uint8Array(getAddressEncoder().encode(address(target.feeRecipient))),
    }),
  ];
}
