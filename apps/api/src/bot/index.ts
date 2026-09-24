import { Bot } from "grammy";
import { env } from "../env.js";
import { effort } from "./commands/effort.js";
import { linkInGroup, linkStart } from "./commands/link.js";
import { me } from "./commands/me.js";
import { raid } from "./commands/raid.js";
import { submit } from "./commands/submit.js";
import { containBotError } from "./errors.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

const commands = bot.errorBoundary(containBotError);

commands.command("start", async (ctx) => {
  if (ctx.chat.type === "private" && (await linkStart(ctx))) return;
  return ctx.reply(
    "Hyphae scores real work for token communities. In a community chat: /link, then /submit.",
  );
});
commands.command("link", (ctx) =>
  ctx.chat.type === "private" ? ctx.reply("Send /link in your community chat.") : linkInGroup(ctx),
);
commands.command("me", me);
commands.command("submit", submit);
commands.command("effort", effort);
commands.command("raid", raid);
