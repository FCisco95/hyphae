import { redirect } from "next/navigation.js";

// Read DEFAULT_MINT per request, not once at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  const mint = process.env.DEFAULT_MINT;
  if (!mint) return <p className="empty">No community is configured.</p>;
  redirect(`/c/${mint}`);
}
