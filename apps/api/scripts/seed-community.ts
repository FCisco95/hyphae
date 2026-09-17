import { communities } from "@hyphae/db";
import { db } from "../src/db.js";

const rubric = {
  version: "0.1.0",
  community: "Hyphae Lab",
  guidelines:
    "Add something real to the conversation. No price promises. No shilling to strangers. Be specific.",
  criteria: [
    {
      key: "relevance",
      label: "On topic",
      weight: 0.4,
      description: "Engages the target's actual point.",
    },
    {
      key: "quality",
      label: "Quality",
      weight: 0.4,
      description: "Clear, original, worth reading.",
    },
    {
      key: "guidelines",
      label: "Within guidelines",
      weight: 0.2,
      description: "Breaks none of the guidelines.",
    },
  ],
  timing: { fullUntil: 30, zeroAt: 240 },
  stakeWeight: "none",
  minHoldUnits: "0",
  proposalAcceptThreshold: 60,
};

await db.insert(communities).values({
  mint: process.env.SEED_MINT as string,
  name: "Hyphae Lab",
  telegramChatId: BigInt(process.env.SEED_CHAT_ID as string),
  adminTelegramUserId: BigInt(process.env.SEED_ADMIN_ID as string),
  rubricVersion: rubric.version,
  rubric,
});
console.log("seeded");
process.exit(0);
