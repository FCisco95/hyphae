import { type BotError, GrammyError, HttpError } from "grammy";

// Only named fields, with the token redacted from each: a BotError's ctx.api holds the bot token,
// a network failure's cause can carry the request URL, and Bot API URLs (including file
// download URLs) embed the token, so any error message may too.
export function botErrorFields(err: BotError) {
  const token = err.ctx.api.token;
  const clean = (s: string | undefined) => s?.replaceAll(token, "<redacted>");
  const update = err.ctx.update.update_id;
  const e = err.error;
  if (e instanceof GrammyError) {
    return {
      update,
      kind: "telegram",
      method: e.method,
      code: e.error_code,
      description: clean(e.description),
    };
  }
  if (e instanceof HttpError) return { update, kind: "network", message: clean(e.message) };
  if (e instanceof Error) {
    return {
      update,
      kind: "app",
      name: clean(e.name),
      message: clean(e.message),
      stack: clean(e.stack),
    };
  }
  return { update, kind: "app", message: clean(String(e)) };
}

// The bot's error boundary. Under a webhook grammY never calls bot.catch: an uncontained error
// reaches the web framework, which logs the whole BotError and answers 500, so Telegram
// redelivers the update to handlers that are not idempotent. Contained, the update is not
// redelivered, so the member is told it may not have finished.
export async function containBotError(err: BotError) {
  console.error("bot error", botErrorFields(err));
  try {
    await err.ctx.reply(
      "Something went wrong and it may not have finished. Check before trying again.",
    );
  } catch {
    // The notice is best-effort; the failure is already logged.
  }
}
