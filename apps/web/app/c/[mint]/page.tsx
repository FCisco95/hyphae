import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { RaidRefresh } from "../../../components/raid-refresh.js";
import { CommunityView, UnavailableView } from "../../../components/views.js";
import { communityPresentation } from "../../../lib/community-presentation.js";
import { readMemberLoginConfig } from "../../../lib/member-login-server.js";
import { readCommunity, readRaids } from "../../../lib/reads.js";

// The same read as the page (Next dedupes it).
export async function generateMetadata(props: {
  params: Promise<{ mint: string }>;
}): Promise<Metadata> {
  const r = await readCommunity((await props.params).mint);
  return { title: r.ok ? r.data.name : "Community" };
}

export default async function CommunityPage(props: { params: Promise<{ mint: string }> }) {
  const { mint } = await props.params;
  const [r, raids] = await Promise.all([readCommunity(mint), readRaids(mint)]);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  const loginEnabled = !!(await readMemberLoginConfig());
  return (
    <>
      <RaidRefresh />
      <CommunityView
        community={r.data}
        presentation={communityPresentation(r.data.mint)}
        raids={raids}
        loginEnabled={loginEnabled}
      />
    </>
  );
}
