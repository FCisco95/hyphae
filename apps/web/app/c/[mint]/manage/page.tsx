import { notFound } from "next/navigation.js";
import { CommunityManagement } from "../../../../components/community-management.js";
import { UnavailableView } from "../../../../components/views.js";
import { readMemberLoginConfig } from "../../../../lib/member-login-server.js";
import { readCommunity } from "../../../../lib/reads.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage community" };

export default async function ManagePage(props: { params: Promise<{ mint: string }> }) {
  const { mint } = await props.params;
  const result = await readCommunity(mint);
  if (!result.ok) return result.reason === "not_found" ? notFound() : <UnavailableView />;
  const community = result.data;
  if (community.mint !== mint) return <UnavailableView />;
  const login = process.env.HYPHAE_ADMIN_ENABLED === "on" ? await readMemberLoginConfig() : null;
  // Disabled pages never load the private control/provider bundle.
  const Provider = login
    ? (await import("../../../../components/community-admin.js")).AdminProvider
    : null;
  return (
    <CommunityManagement community={community}>
      {login && Provider ? (
        <Provider appId={login.appId} community={{ mint: community.mint, name: community.name }} />
      ) : null}
    </CommunityManagement>
  );
}
