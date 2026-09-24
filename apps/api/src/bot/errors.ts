import { type BotError, GrammyError, HttpError } from "grammy";

// Only named fields: a BotError's ctx.api holds the bot token, and a network failure's cause
// can carry the request URL, which also contains it.
export function botErrorFields(err: BotError) {
  const update = err.ctx.update.update_id;
  const e = err.error;
  if (e instanceof GrammyError) {
    return {
      update,
      kind: "telegram",
      method: e.method,
      code: e.error_code,
      description: e.description,
    };
  }
  if (e instanceof HttpError) return { update, kind: "network", message: e.message };
  if (e instanceof Error) {
    return { update, kind: "app", name: e.name, message: e.message, stack: e.stack };
  }
  return { update, kind: "app", message: String(e) };
}

// Installed as the bot's error boundary. Under a webhook grammY never calls bot.catch: an
// uncontained error reaches the web framework, which logs the whole BotError and answers 500,
// so Telegram redelivers the update.
export function logBotError(err: BotError) {
  console.error("bot error", botErrorFields(err));
}
