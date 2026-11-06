import { AbortController as TelegramAbortController } from "abort-controller";
import type { Api } from "grammy";
import { assertActive } from "./guard.js";
import type { TelegramAdmin } from "./routes.js";

type TelegramSignal = Parameters<Api["getChatMember"]>[2];
type Member = { status: string; user: { id: number; is_bot: boolean } };
export interface AdminTelegramApi {
  getMe(signal?: TelegramSignal): Promise<{ id: number; is_bot: boolean }>;
  getChatMember(chat: string, user: number, signal?: TelegramSignal): Promise<Member>;
}

// Telegram only guarantees another user's membership lookup when the bot is an admin.
// Keep both reads fresh; neither a cached role nor another group grants authority here.
export function telegramAdministrator(api: AdminTelegramApi): TelegramAdmin {
  return async (chatId, actorId, signal) => {
    assertActive(signal);
    if (chatId >= 0n || actorId <= 0n || actorId > BigInt(Number.MAX_SAFE_INTEGER)) return false;
    const controller = new TelegramAbortController();
    const cancel = () => controller.abort();
    signal.addEventListener("abort", cancel, { once: true });
    try {
      const bot = await api.getMe(controller.signal);
      assertActive(signal);
      if (!bot.is_bot || !Number.isSafeInteger(bot.id) || bot.id <= 0) return false;
      const own = await api.getChatMember(String(chatId), bot.id, controller.signal);
      assertActive(signal);
      if (own.status !== "administrator" || own.user.id !== bot.id || !own.user.is_bot)
        return false;
      const member = await api.getChatMember(String(chatId), Number(actorId), controller.signal);
      assertActive(signal);
      return (
        (member.status === "administrator" || member.status === "creator") &&
        member.user.id === Number(actorId) &&
        !member.user.is_bot
      );
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  };
}
