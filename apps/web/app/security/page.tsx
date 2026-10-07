import type { Metadata } from "next";
import { TrustPage } from "../../components/trust.js";

export const metadata: Metadata = {
  title: "Security and trust",
  description:
    "What Hyphae's admin can and cannot do, where the keys are, the verifiable build, the independent AI reviews, privacy and how to report a problem.",
};

export default function Security() {
  return <TrustPage />;
}
