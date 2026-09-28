import type { Metadata } from "next";
import { Kumbh_Sans } from "next/font/google";
import { BrandSprite } from "../components/brand.js";
import { SiteFooter, SiteHeader } from "../components/site.js";
import "./globals.css";

const kumbh = Kumbh_Sans({ subsets: ["latin"], variable: "--font-kumbh", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Hyphae: proof of contribution for token communities",
    template: "%s · Hyphae",
  },
  description:
    "Members do real work for a community, an AI scores it against public guidelines and shows its reasoning, and each epoch's payouts are committed to Solana.",
  openGraph: { siteName: "Hyphae", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={kumbh.variable}>
      <body>
        <BrandSprite />
        <a className="skip" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
