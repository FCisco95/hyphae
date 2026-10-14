// Local live check of raid cards: a test bot polling in a private test group, against a local
// Postgres, configured only from .env.dev-bot. dev-bot-guard refuses the production database and
// bot. From the repo root:
//   docker run -d --name hyphae-dev-pg -p 55433:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=hyphae postgres:17
//   pnpm --filter @hyphae/api exec tsx scripts/dev-bot.ts --seed   (first run; add --worker to score)
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { checkDevBotEnv } from "./dev-bot-guard.js";

const read = (name: string): Record<string, string | undefined> => {
  const file = new URL(`../../../${name}`, import.meta.url);
  return existsSync(file) ? parseEnv(readFileSync(file, "utf8").replace(/^﻿/, "")) : {};
};
const dev = read(".env.dev-bot");
const checked = checkDevBotEnv(dev, read(".env"));
if (!checked.ok) {
  console.error(`dev-bot: ${checked.reason}`);
  process.exit(1);
}
// Stands in for the web's card route, so the photo path runs without a deployed raid.
const image = dev.DEV_CARD_IMAGE ? readFileSync(dev.DEV_CARD_IMAGE) : null;
const server = createServer((request, response) => {
  const card = image !== null && /^\/c\/[^/]+\/r\/[^/]+\/card$/.test(request.url ?? "");
  response.writeHead(card ? 200 : 404, card ? { "content-type": "image/png" } : {});
  response.end(card ? image : undefined);
}).listen(0, "127.0.0.1");
await once(server, "listening");
Object.assign(process.env, {
  DATABASE_URL: dev.DATABASE_URL,
  TELEGRAM_BOT_TOKEN: dev.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET: "dev-bot-local-webhook-unused",
  LINK_ORIGIN: "https://dev-bot.invalid",
  PUBLIC_WEB_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  RAID_CARDS: "on",
  ...(dev.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: dev.ANTHROPIC_API_KEY } : {}),
});

const { db } = await import("../src/db.js");
const { migrate } = await import("drizzle-orm/postgres-js/migrator");
await migrate(db, {
  migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
});
if (process.argv.includes("--seed")) {
  const { seedDevCommunity } = await import("./dev-bot-seed.js");
  console.log(`dev-bot: seeded ${await seedDevCommunity(db, checked)}`);
}
const { startQueue } = await import("../src/jobs/queue.js");
await startQueue();
const { bot } = await import("../src/bot/index.js");
const { startRaidNotifier } = await import("../src/raid-alerts/runner.js");
const { registerCommandMenus } = await import("../src/bot/command-menus.js");
startRaidNotifier(db, bot.api, process.env.PUBLIC_WEB_URL as string);
console.log(
  JSON.stringify({
    commands: await registerCommandMenus(bot.api, [
      { chatId: checked.chatId, adminId: checked.adminId },
    ]),
  }),
);
if (process.argv.includes("--worker")) void import("../src/worker.js");
await bot.start({
  drop_pending_updates: true,
  onStart: (me) => console.log(`dev-bot: @${me.username} polling; Ctrl+C stops`),
});
