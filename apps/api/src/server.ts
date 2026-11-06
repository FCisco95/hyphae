import { serve } from "@hono/node-server";
import { communities } from "@hyphae/db";
import { createSolanaRpc } from "@solana/kit";
import { Api, webhookCallback } from "grammy";
import { Hono } from "hono";
import { adminRoutes } from "./admin/routes.js";
import { telegramAdministrator } from "./admin/telegram.js";
import { registerCommandMenus } from "./bot/command-menus.js";
import { bot } from "./bot/index.js";
import { webhookOptions } from "./bot/webhook-options.js";
import { db } from "./db.js";
import { env } from "./env.js";
import { settlementReader } from "./http/chain-reader.js";
import { docsRoutes } from "./http/docs.js";
import { readRoutes } from "./http/routes.js";
import { organicKey } from "./integrations/hmac.js";
import { postRaid } from "./integrations/raids.js";
import { integrationRoutes } from "./integrations/routes.js";
import { telegramRaidDeps } from "./integrations/telegram.js";
import { startQueue } from "./jobs/queue.js";
import { telegramLinkedNotifier } from "./link/notify.js";
import { assertProofConfig, proofConfig } from "./link/proof-config.js";
import { linkRoutes } from "./link/routes.js";
import { memberAuthConfig } from "./member-auth/config.js";
import { privyIdentity } from "./member-auth/privy.js";
import { memberRoutes } from "./member-auth/routes.js";
import { telegramMembership } from "./member-auth/telegram.js";
import { startRaidNotifier } from "./raid-alerts/runner.js";
import { stopApiOnSignals } from "./raid-alerts/shutdown.js";

assertProofConfig();

// Scoring/settlement jobs still run in the frozen worker; private raid alerts use the API outbox.
await startQueue();
const notifyApi = new Api(env.TELEGRAM_BOT_TOKEN, { timeoutSeconds: 4 });
const raidNotifier = startRaidNotifier(db, notifyApi, env.PUBLIC_WEB_URL);
stopApiOnSignals(raidNotifier.stop);
// Telegram's "/" menus, best effort; start-up never waits on them.
void db
  .select({ chatId: communities.telegramChatId, adminId: communities.adminTelegramUserId })
  .from(communities)
  .then((admins) => registerCommandMenus(notifyApi, admins))
  .then((results) => console.log(JSON.stringify({ commands: results })))
  .catch(() => console.error("commands: menu registration failed"));

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.post("/telegram", webhookCallback(bot, "hono", webhookOptions(env.TELEGRAM_WEBHOOK_SECRET)));
app.route(
  "/link",
  linkRoutes({ db, tenant: proofConfig(), notify: telegramLinkedNotifier(notifyApi) }),
);
app.route("/docs", docsRoutes());
const memberConfig = memberAuthConfig(env);
const memberIdentity = memberConfig ? privyIdentity(memberConfig) : undefined;
app.route(
  "/member/v1",
  memberRoutes({
    db,
    ...(memberIdentity ? { identity: memberIdentity } : {}),
    chatMember: telegramMembership(notifyApi),
    ...(env.READ_API_WEB_TOKEN ? { webToken: env.READ_API_WEB_TOKEN } : {}),
  }),
);
app.route(
  "/admin/v1",
  adminRoutes({
    db,
    enabled: env.ADMIN_API_ENABLED === "on",
    ...(memberIdentity ? { identity: memberIdentity } : {}),
    telegramAdmin: telegramAdministrator(notifyApi),
    ...(env.READ_API_WEB_TOKEN ? { webToken: env.READ_API_WEB_TOKEN } : {}),
  }),
);
// Before /v1, so the public read middleware never handles a signed write.
const raidDeps = telegramRaidDeps(db, new Api(env.TELEGRAM_BOT_TOKEN), env.PUBLIC_WEB_URL);
app.route(
  "/v1/integrations",
  integrationRoutes({
    key: organicKey(env.ORGANIC_HMAC_KEY_ID, env.ORGANIC_HMAC_KEY),
    postRaid: (mint, keyId, request) => postRaid(raidDeps, mint, keyId, request),
  }),
);
app.route(
  "/v1",
  readRoutes({
    db,
    chain: env.READ_RPC_URL ? settlementReader(createSolanaRpc(env.READ_RPC_URL)) : undefined,
    webToken: env.READ_API_WEB_TOKEN,
  }),
);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on :${info.port}`);
});
