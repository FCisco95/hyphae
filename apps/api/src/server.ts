import { serve } from "@hono/node-server";
import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { bot } from "./bot/index.js";
import { env } from "./env.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.post("/telegram", webhookCallback(bot, "hono", { secretToken: env.TELEGRAM_WEBHOOK_SECRET }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on :${info.port}`);
});
