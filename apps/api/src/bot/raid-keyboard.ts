import { InlineKeyboard } from "grammy";
import { engageLinks } from "../x/intents.js";

// The group's raid message: engage on X in one tap, then submit privately to the bot.
export function raidKeyboard(botUsername: string, taskId: string, postUrl: string) {
  return engageLinks(postUrl)
    .reduce((kb, link) => kb.url(link.label, link.url), new InlineKeyboard())
    .row()
    .url("Submit my reply privately", `https://t.me/${botUsername}?start=reply_${taskId}`)
    .row()
    .url("Submit my quote privately", `https://t.me/${botUsername}?start=quote_${taskId}`);
}
