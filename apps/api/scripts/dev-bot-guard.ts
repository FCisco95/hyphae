export type DevBotCheck =
  | { ok: true; chatId: bigint; adminId: bigint; databaseUrl: string }
  | { ok: false; reason: string };

// pg pulls the host from `?host=`, postgres-js splits `#,` and `,` into a host list, and WHATWG
// URL reads only the first authority, so a url that looks local can still connect elsewhere.
// Accept one plain user:password@host:port/database and rebuild it, so the driver never sees the
// raw text.
function localDatabaseUrl(raw: string | undefined): string | null {
  if (!raw || /\s/.test(raw) || /[?#,]/.test(raw) || (raw.match(/@/g)?.length ?? 0) > 1)
    return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return null;
    if (!/^\/[^/]+$/.test(url.pathname)) return null;
    const login = url.username ? `${url.username}${url.password ? `:${url.password}` : ""}@` : "";
    return `postgres://${login}${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return null;
  }
}

// The root .env holds production values. The dev runner may only reach a database on this machine
// and a bot that is not the production bot: polling with the production token deletes its webhook.
export function checkDevBotEnv(
  dev: Record<string, string | undefined>,
  production: Record<string, string | undefined>,
): DevBotCheck {
  const databaseUrl = localDatabaseUrl(dev.DATABASE_URL);
  if (!databaseUrl)
    return {
      ok: false,
      reason:
        "DATABASE_URL in .env.dev-bot must be one plain local Postgres url (127.0.0.1), with no query, fragment or extra hosts",
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
    databaseUrl,
  };
}

// Independent of any file: the production bot is the only one with a webhook, and polling with
// its token would delete it. Run on Telegram's getWebhookInfo before any other Telegram call.
export function refuseWebhookBot(info: { url?: string }): string | null {
  if (info.url === "") return null;
  return info.url === undefined
    ? "Telegram did not say whether that bot has a webhook"
    : "that bot has a webhook, so it is a deployed bot (the production one?); polling would delete it. Use a test bot with no webhook";
}
