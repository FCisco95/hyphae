import { communities, type Db } from "@hyphae/db";
import { bootstrapRewardEpochs, buildRewardConfigPayload } from "../src/rewards/config.js";

const rubric = {
  version: "1.2.0",
  community: "Hyphae Dev",
  guidelines: "Add something real to the conversation. No price promises. Be specific.",
  criteria: [
    { key: "context_fit", label: "Specific", weight: 1, description: "Reacts to the post." },
  ],
  timing: { fullUntil: 360, zeroAt: 2880 },
  stakeWeight: "none" as const,
  minHoldUnits: "100000000000",
  proposalAcceptThreshold: 70,
};

// The local test community: the test group, its admin and an open reward epoch, so private
// submissions take the reward lane as they do in production.
export async function seedDevCommunity(db: Db, ids: { chatId: bigint; adminId: bigint }) {
  const [community] = await db
    .insert(communities)
    .values({
      mint: "DevMint1",
      name: "Hyphae Dev",
      telegramChatId: ids.chatId,
      adminTelegramUserId: ids.adminId,
      rubricVersion: rubric.version,
      rubric,
    })
    .onConflictDoNothing()
    .returning();
  if (!community) return "nothing new (already seeded)";
  await bootstrapRewardEpochs(db, {
    communityId: community.id,
    payload: buildRewardConfigPayload(rubric),
    opensAt: new Date(),
    proposedBy: "dev-bot",
  });
  return `community ${community.id}`;
}
