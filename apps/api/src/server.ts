import { serve } from "@hono/node-server";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { bot } from "./bot/index.js";
import { db } from "./db.js";
import { env } from "./env.js";
import { readRoutes } from "./http/routes.js";
import { startQueue } from "./jobs/queue.js";
import { assertProofConfig, proofConfig } from "./link/proof-config.js";
import { linkRoutes } from "./link/routes.js";

assertProofConfig();

// The api only sends jobs; `work` runs in the worker process.
await startQueue();

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.post("/telegram", webhookCallback(bot, "hono", { secretToken: env.TELEGRAM_WEBHOOK_SECRET }));
app.route("/link", linkRoutes({ db, tenant: proofConfig() }));
app.route("/v1", readRoutes({ db }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on :${info.port}`);
});
