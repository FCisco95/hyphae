import { card, OG_SIZE } from "../components/og.js";

export const alt = "Hyphae: proof of contribution for token communities.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return card({
    context: "Built solo for Colosseum's Crypto World's Fair",
    title: "Proof of contribution for token communities.",
    footer: "Pay the people who do the work, and show everyone how.",
  });
}
