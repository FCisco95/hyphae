import { buildRewardConfigPayload } from "../rewards/config.js";
import { rubric } from "../rewards/test-db.js";

export function manifest(name = "Alpha", second = false) {
  return {
    version: 1,
    environment: "disposable",
    database: { host: "127.0.0.1", port: 55433, name: "hyphae" },
    communityId: second
      ? "00000000-0000-4000-8000-000000000002"
      : "00000000-0000-4000-8000-000000000001",
    mint: second
      ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      : "So11111111111111111111111111111111111111112",
    name,
    telegramChatId: second ? "-100200" : "-100100",
    adminTelegramUserId: second ? "22" : "11",
    botUserId: "99",
    approvalReference: `test-${name.toLowerCase()}`,
    activationTime: "2099-01-01T00:00:00.000Z",
    rewardConfig: buildRewardConfigPayload({ ...rubric, community: name }),
  };
}

export function telegramFor(m = manifest()) {
  return {
    getMe: async () => ({ id: Number(m.botUserId), is_bot: true }),
    getChat: async () => ({ id: Number(m.telegramChatId), type: "supergroup" }),
    getChatMember: async (_chat: number, user: number) => ({
      user: { id: user, is_bot: user === Number(m.botUserId) },
      status: user === Number(m.botUserId) ? "administrator" : "creator",
    }),
  };
}
