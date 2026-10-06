import { type Api, InlineKeyboard } from "grammy";
import { setupPayload } from "../bot/commands/setup-content.js";

export interface LinkedNote {
  telegramUserId: bigint;
  communityId: string;
  communityName: string;
  wallet: string;
}

// The wallet page says "Linked", but a member who closes it never learns the link worked. The
// notice carries no link or token: only the community and the wallet's first and last characters.
export function linkedNotice(n: LinkedNote): { text: string; callback: string } {
  const short = `${n.wallet.slice(0, 4)}…${n.wallet.slice(-4)}`;
  return {
    text: `Wallet linked for ${n.communityName}: ${short}. Tap below to see your next setup step.`,
    callback: setupPayload(n.communityId),
  };
}

export async function sendLinkedNotice(
  send: (chatId: number, text: string, callback: string) => Promise<unknown>,
  n: LinkedNote,
): Promise<void> {
  const chatId = Number(n.telegramUserId);
  if (!Number.isSafeInteger(chatId)) return;
  const { text, callback } = linkedNotice(n);
  await send(chatId, text, callback);
}

export const telegramLinkedNotifier = (api: Api) => (n: LinkedNote) =>
  sendLinkedNotice(
    (chatId, text, callback) =>
      api.sendMessage(chatId, text, {
        reply_markup: new InlineKeyboard().text("Check my setup", callback),
      }),
    n,
  );
