import type { Metadata } from "next";
import { RulesView } from "../../components/rules.js";
import { readCommunity, readEpoch } from "../../lib/reads.js";
import { rulesStatus } from "../../lib/rules.js";

export const metadata: Metadata = {
  title: "The rules",
  description: "How MYCEL grades a reply, with sample replies the founder graded.",
};

// Read DEFAULT_MINT and the open epoch's rubric per request, not once at build time.
export const dynamic = "force-dynamic";

// The study page the bot links before the rules test.
export default async function Rules() {
  const mint = process.env.DEFAULT_MINT;
  const community = mint ? await readCommunity(mint) : undefined;
  const status = await rulesStatus(community?.ok ? community.data.epochs : null, (index) =>
    readEpoch(mint ?? "", String(index)),
  );
  return <RulesView status={status} />;
}
