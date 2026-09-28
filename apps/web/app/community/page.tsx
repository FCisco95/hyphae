import { redirect } from "next/navigation.js";

// Read DEFAULT_MINT per request, not once at build time.
export const dynamic = "force-dynamic";

// The default community's audit page, at a stable address for the site's navigation.
export default function Community() {
  const mint = process.env.DEFAULT_MINT;
  if (!mint) return <p className="empty">No community is configured.</p>;
  redirect(`/c/${mint}`);
}
