import { headers } from "next/headers.js";
import { notFound } from "next/navigation.js";
import { privyDevelopmentConfig } from "../../../lib/privy-development-config.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local sign-in test", robots: { index: false, follow: false } };

export default async function PrivyDevelopmentPage() {
  const config = privyDevelopmentConfig(
    {
      appId: process.env.PRIVY_DEV_APP_ID,
      productionAppId: process.env.PRIVY_APP_ID,
      localPreview: process.env.HYPHAE_LOCAL_PREVIEW,
      vercel: process.env.VERCEL,
    },
    (await headers()).get("host") ?? "",
  );
  if (!config) notFound();
  const { PrivyDevelopmentProvider } = await import("../../../components/privy-development.js");
  return <PrivyDevelopmentProvider appId={config.appId} />;
}
