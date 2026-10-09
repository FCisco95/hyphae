import { notFound } from "next/navigation.js";
import { MemberAccountView } from "../../../../components/member-account.js";
import { UnavailableView } from "../../../../components/views.js";
import { readMemberLoginConfig } from "../../../../lib/member-login-server.js";
import { readCommunity } from "../../../../lib/reads.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your community account" };

export default async function MemberPage(props: { params: Promise<{ mint: string }> }) {
  const result = await readCommunity((await props.params).mint);
  if (!result.ok) return result.reason === "not_found" ? notFound() : <UnavailableView />;
  const community = { mint: result.data.mint, name: result.data.name };
  const base = `/c/${encodeURIComponent(community.mint)}`;
  const config = await readMemberLoginConfig();
  // Keep provider imports out of public pages and the disabled member response.
  const Provider = config
    ? (await import("../../../../components/member-provider.js")).MemberProvider
    : null;
  return (
    <>
      <nav className="community-nav" aria-label="Community">
        <a href={base}>Overview</a>
        <a href={`${base}/about`}>Project context</a>
        <a href={`${base}/join`}>Get started</a>
        <a href={`${base}/me`} aria-current="page">
          Your account
        </a>
      </nav>
      {config && Provider ? (
        <Provider appId={config.appId} community={community} />
      ) : (
        <MemberAccountView community={community} state={{ kind: "disabled" }} />
      )}
    </>
  );
}
