import { RubricSchema } from "@hyphae/core";
import type { communities, Db, tasks } from "@hyphae/db";
import type { Api, InlineKeyboard } from "grammy";
import { raidKeyboard } from "../bot/raid-keyboard.js";
import { clipMessageText } from "../bot/text.js";
import { announceCard, telegramCardSender, webCardImage } from "../raid-cards/announce.js";
import { raidCardsOn } from "../raid-cards/flag.js";
import type { XPost } from "../x/oembed.js";
import { alertLink } from "./alerts.js";

export interface RaidAnnouncer {
  api: Api;
  botUsername: string;
  // The plain announcement when raid cards are off. /raid replies in the command's chat and topic.
  sendText(
    text: string,
    other: { reply_markup: InlineKeyboard; link_preview_options: { is_disabled: true } },
  ): Promise<{ message_id: number }>;
}

// The group's announcement of a newly opened raid, the same whether /raid or Organic opened it.
// Returns the announcement's message id.
export async function announceRaid(
  db: Db,
  to: RaidAnnouncer,
  community: typeof communities.$inferSelect,
  post: XPost,
  task: typeof tasks.$inferSelect,
  hours: number,
  webUrl: string,
): Promise<number> {
  if (raidCardsOn()) {
    const card = await announceCard(
      db,
      { community, task, botUsername: to.botUsername, now: task.opensAt },
      telegramCardSender(to.api, webCardImage(webUrl, community.mint, task.id)),
    );
    return card.messageId;
  }
  const rubric = RubricSchema.parse(community.rubric);
  const sent = await to.sendText(
    [
      `Raid open for ${hours}h — @${post.handle}:`,
      `"${clipMessageText(post.text, 200)}"`,
      post.url,
      task.brief ? `Brief: ${task.brief}` : "",
      `Raid ID: ${task.id}`,
      `Tap Reply on X or Quote on X, post it, then tap Submit below and paste your post's link. One of each per member. Full credit for the first ${rubric.timing.fullUntil / 60}h, decaying to zero at ${hours}h.`,
      `Optional private alerts for future raids: ${alertLink(to.botUsername, community.id)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    {
      reply_markup: raidKeyboard(to.botUsername, task.id, post.url),
      link_preview_options: { is_disabled: true },
    },
  );
  return sent.message_id;
}
