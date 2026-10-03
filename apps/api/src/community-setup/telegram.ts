import { Api } from "grammy";
import { SetupError, type SetupManifest } from "./manifest.js";

export interface SetupTelegram {
  getMe(): Promise<{ id: number; is_bot: boolean }>;
  getChat(chatId: number): Promise<{ id: number; type: string }>;
  getChatMember(
    chatId: number,
    userId: number,
  ): Promise<{
    user: { id: number; is_bot: boolean };
    status: string;
  }>;
}

export function setupTelegramReader(token: string): SetupTelegram {
  const api = new Api(token, { timeoutSeconds: 10 });
  return {
    getMe: () => api.getMe(),
    getChat: (chat) => api.getChat(chat),
    getChatMember: (chat, user) => api.getChatMember(chat, user),
  };
}

export async function verifySetupTelegram(m: SetupManifest, api: SetupTelegram): Promise<void> {
  try {
    const bot = await api.getMe();
    if (!bot.is_bot || String(bot.id) !== m.botUserId)
      throw new SetupError("telegram_bot_mismatch");
    const chatId = Number(m.telegramChatId);
    const chat = await api.getChat(chatId);
    if (chat.id !== chatId || (chat.type !== "group" && chat.type !== "supergroup"))
      throw new SetupError("telegram_chat_mismatch");
    // Telegram only guarantees other-member lookup when the bot is a chat administrator.
    const botMember = await api.getChatMember(chatId, bot.id);
    if (
      botMember.status !== "administrator" ||
      botMember.user.id !== bot.id ||
      !botMember.user.is_bot
    )
      throw new SetupError("telegram_bot_not_admin");
    const admin = await api.getChatMember(chatId, Number(m.adminTelegramUserId));
    if (
      (admin.status !== "creator" && admin.status !== "administrator") ||
      String(admin.user.id) !== m.adminTelegramUserId ||
      admin.user.is_bot
    )
      throw new SetupError("telegram_admin_unverified");
  } catch (error) {
    if (error instanceof SetupError) throw error;
    // grammY errors can retain token-bearing request objects. Never return them or a cause.
    throw new SetupError("telegram_unavailable");
  }
}
