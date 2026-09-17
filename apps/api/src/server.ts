import { serve } from "@hono/node-server";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { bot } from "./bot/index.js";
import { env } from "./env.js";
import { startQueue } from "./jobs/queue.js";

// The api only sends jobs; `work` runs in the worker process.
await startQueue();

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.post("/telegram", webhookCallback(bot, "hono", { secretToken: env.TELEGRAM_WEBHOOK_SECRET }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on :${info.port}`);
});
