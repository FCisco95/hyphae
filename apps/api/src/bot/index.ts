import { Bot } from "grammy";
import { env } from "../env.js";
import { link } from "./commands/link.js";
import { me } from "./commands/me.js";
import { raid } from "./commands/raid.js";
import { submit } from "./commands/submit.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

bot.command("start", (ctx) =>
  ctx.reply(
    "Hyphae scores real work for token communities. In a community chat: /link <wallet>, then /submit.",
  ),
);
bot.command("link", link);
bot.command("me", me);
bot.command("submit", submit);
bot.command("raid", raid);

bot.catch((err) => {
  console.error("bot error", { update: err.ctx.update.update_id, error: err.error });
});
