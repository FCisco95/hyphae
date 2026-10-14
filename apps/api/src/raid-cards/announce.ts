import { RubricSchema } from "@hyphae/core";
import type { communities, Db, tasks } from "@hyphae/db";
import { type Api, GrammyError, type InlineKeyboard, InputFile } from "grammy";
import { cardCaption, cardKeyboard, EMPTY_STATS, renderHash } from "./render.js";
import { recordCard } from "./store.js";

export interface CardSender {
  image(): Promise<Uint8Array | null>;
  sendPhoto(
    chatId: bigint,
    photo: InputFile,
    caption: string,
    keyboard: InlineKeyboard,
  ): Promise<{ message_id: number }>;
  sendText(chatId: bigint, text: string, keyboard: InlineKeyboard): Promise<{ message_id: number }>;
  pin(chatId: bigint, messageId: number): Promise<unknown>;
}

// Sends a new raid's card, pins it quietly and records it for the refresher. A raid is never left
// unannounced: no picture, or a picture Telegram rejects, sends the same card as text. A network
// error is not retried as text, because the picture may have arrived.
export async function announceCard(
  db: Db,
  input: {
    community: typeof communities.$inferSelect;
    task: typeof tasks.$inferSelect;
    botUsername: string;
    now: Date;
  },
  deps: CardSender,
): Promise<{ messageId: number; format: "photo" | "text" }> {
  const { community, task, now } = input;
  const rubric = RubricSchema.parse(community.rubric);
  const caption = cardCaption({
    state: "open",
    handle: task.targetAuthor,
    closesAt: task.closesAt,
    brief: task.brief,
    fullUntilMinutes: rubric.timing.fullUntil,
    stats: EMPTY_STATS,
    ranMs: 0,
    cancelReason: null,
    now,
  });
  const keyboard = cardKeyboard("open", input.botUsername, task.id, task.targetUrl ?? "", null);
  const chatId = community.telegramChatId;
  const image = await deps.image().catch(() => null);
  let sent: { message_id: number } | undefined;
  let format: "photo" | "text" = "text";
  if (image) {
    try {
      sent = await deps.sendPhoto(chatId, new InputFile(image, "raid.png"), caption, keyboard);
      format = "photo";
    } catch (e) {
      if (!(e instanceof GrammyError && e.error_code === 400)) throw e;
    }
  }
  sent ??= await deps.sendText(chatId, caption, keyboard);
  let pinError: string | null = null;
  try {
    await deps.pin(chatId, sent.message_id);
  } catch (e) {
    pinError = e instanceof GrammyError ? `pin_${e.error_code}` : "pin_failed";
  }
  await recordCard(db, {
    taskId: task.id,
    communityId: community.id,
    telegramChatId: chatId,
    telegramMessageId: sent.message_id,
    format,
    state: "open",
    renderedHash: renderHash(caption, keyboard),
    nextRefreshAt: new Date(now.getTime() + 60_000),
    pinnedAt: pinError ? null : now,
    pinError,
  });
  return { messageId: sent.message_id, format };
}

export function telegramCardSender(api: Api, image: () => Promise<Uint8Array | null>): CardSender {
  return {
    image,
    sendPhoto: (chat, photo, caption, keyboard) =>
      api.sendPhoto(Number(chat), photo, { caption, parse_mode: "HTML", reply_markup: keyboard }),
    sendText: (chat, text, keyboard) =>
      api.sendMessage(Number(chat), text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      }),
    pin: (chat, messageId) =>
      api.pinChatMessage(Number(chat), messageId, { disable_notification: true }),
  };
}

// The web draws the card from public data; the bot uploads the bytes, so a slow route never
// makes Telegram give up on the URL.
export const webCardImage = (webBase: string, mint: string, taskId: string) => async () => {
  const response = await fetch(
    `${webBase.replace(/\/$/, "")}/c/${encodeURIComponent(mint)}/r/${taskId}/card`,
    { signal: AbortSignal.timeout(8_000) },
  );
  if (!response.ok || response.headers.get("content-type") !== "image/png") return null;
  return new Uint8Array(await response.arrayBuffer());
};
