import { serve } from "@hono/node-server";
import { createSolanaRpc } from "@solana/kit";
import { Api, webhookCallback } from "grammy";
import { Hono } from "hono";
import { bot } from "./bot/index.js";
import { db } from "./db.js";
import { env } from "./env.js";
import { settlementReader } from "./http/chain-reader.js";
import { docsRoutes } from "./http/docs.js";
import { readRoutes } from "./http/routes.js";
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
const raidNotifier = startRaidNotifier(db, notifyApi);
stopApiOnSignals(raidNotifier.stop);

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.post("/telegram", webhookCallback(bot, "hono", { secretToken: env.TELEGRAM_WEBHOOK_SECRET }));
app.route(
  "/link",
  linkRoutes({ db, tenant: proofConfig(), notify: telegramLinkedNotifier(notifyApi) }),
);
app.route("/docs", docsRoutes());
const memberConfig = memberAuthConfig(env);
app.route(
  "/member/v1",
  memberRoutes({
    db,
    ...(memberConfig ? { identity: privyIdentity(memberConfig) } : {}),
    chatMember: telegramMembership(notifyApi),
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
