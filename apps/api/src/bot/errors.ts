import { type BotError, GrammyError, HttpError } from "grammy";

// Only named fields, with the token redacted from each: a BotError's ctx.api holds the bot token,
// a network failure's cause can carry the request URL, and Bot API URLs (including file
// download URLs) embed the token, so any error message may too.
function errorFields(e: unknown, token: string) {
  const clean = (s: string | undefined) => s?.replaceAll(token, "<redacted>");
  if (e instanceof GrammyError) {
    return {
      kind: "telegram",
      method: e.method,
      code: e.error_code,
      description: clean(e.description),
    };
  }
  if (e instanceof HttpError) return { kind: "network", message: clean(e.message) };
  if (e instanceof Error) {
    return { kind: "app", name: clean(e.name), message: clean(e.message), stack: clean(e.stack) };
  }
  return { kind: "app", message: clean(String(e)) };
}

export function botErrorFields(err: BotError) {
  return { update: err.ctx.update.update_id, ...errorFields(err.error, err.ctx.api.token) };
}

// A Bot API call outside the bot's handlers (the worker's notices). A failure is rethrown as a
// plain Error made of those fields, never the original: grammY's network error keeps node-fetch's,
// whose message is the request URL, and pg-boss stores a failed job's error, nested ones included.
export async function telegramCall<T>(token: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw new Error(`telegram: ${JSON.stringify(errorFields(e, token))}`);
  }
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
