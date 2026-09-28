import { card, OG_SIZE } from "../../../components/og.js";
import { contributionCard } from "../../../lib/cards.js";
import { readContribution } from "../../../lib/reads.js";

export const alt = "A contribution's score on Hyphae, with its reasons.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await readContribution(id);
  return card({
    ...contributionCard(r.ok ? r.data : null),
    footer: "Every revision and its reasoning are on the audit page.",
  });
}
