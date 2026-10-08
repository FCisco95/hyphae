import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { UnavailableView } from "../../../components/views.js";
import { WalletRecordView } from "../../../components/wallet.js";
import { shortWallet } from "../../../lib/format.js";
import { readWalletRecord } from "../../../lib/reads.js";
import { recordDescription } from "../../../lib/record.js";

type Props = {
  params: Promise<{ wallet: string }>;
  searchParams: Promise<{ offset?: string }>;
};

const offsetOf = (offset: string | undefined) =>
  /^\d{1,9}$/.test(offset ?? "") ? Number(offset) : 0;

// The same read as the page (Next dedupes it).
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { wallet } = await props.params;
  const { offset } = await props.searchParams;
  const r = await readWalletRecord(wallet, offsetOf(offset));
  return { title: `Wallet ${shortWallet(wallet)}`, description: recordDescription(r) };
}

export default async function WalletPage(props: Props) {
  const { wallet } = await props.params;
  const { offset } = await props.searchParams;
  const r = await readWalletRecord(wallet, offsetOf(offset));
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  return <WalletRecordView record={r.data} />;
}
