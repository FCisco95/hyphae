import { AbortController as TelegramAbortController } from "abort-controller";
import type { Api } from "grammy";

export function telegramMembership(
  api: Pick<Api, "getChatMember">,
): (
  chatId: bigint,
  userId: bigint,
  signal: AbortSignal,
) => Promise<{ status: string; is_member?: boolean }> {
  return async (chatId, userId, signal) => {
    signal.throwIfAborted();
    // grammY exposes its Node shim signal type. Bridge it rather than casting the native type.
    const controller = new TelegramAbortController();
    const cancel = () => controller.abort();
    signal.addEventListener("abort", cancel, { once: true });
    try {
      return await api.getChatMember(String(chatId), Number(userId), controller.signal);
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  };
}
