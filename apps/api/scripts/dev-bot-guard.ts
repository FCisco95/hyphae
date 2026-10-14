export type DevBotCheck =
  | { ok: true; chatId: bigint; adminId: bigint }
  | { ok: false; reason: string };

// The root .env holds production values. The dev runner may only reach a database on this machine
// and a bot that is not the production bot: polling with the production token deletes its webhook.
export function checkDevBotEnv(
  dev: Record<string, string | undefined>,
  production: Record<string, string | undefined>,
): DevBotCheck {
  let host = "";
  try {
    host = new URL(dev.DATABASE_URL ?? "").hostname;
  } catch {}
  if (host !== "127.0.0.1" && host !== "localhost")
    return {
      ok: false,
      reason: "DATABASE_URL in .env.dev-bot must be a local Postgres (127.0.0.1)",
    };
  const token = dev.TELEGRAM_BOT_TOKEN ?? "";
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token))
    return { ok: false, reason: "TELEGRAM_BOT_TOKEN in .env.dev-bot must be the test bot's token" };
  const productionBot = production.TELEGRAM_BOT_TOKEN?.split(":")[0];
  if (productionBot && token.split(":")[0] === productionBot)
    return { ok: false, reason: "that is the production bot; use the test bot's token" };
  if (!/^-\d{5,}$/.test(dev.DEV_CHAT_ID ?? ""))
    return { ok: false, reason: "DEV_CHAT_ID must be the test group's id (negative)" };
  if (!/^\d{5,}$/.test(dev.DEV_ADMIN_ID ?? ""))
    return { ok: false, reason: "DEV_ADMIN_ID must be your Telegram user id" };
  return {
    ok: true,
    chatId: BigInt(dev.DEV_CHAT_ID as string),
    adminId: BigInt(dev.DEV_ADMIN_ID as string),
  };
}
