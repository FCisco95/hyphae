// Read-only bot checks for the 2026-10-05 API rollout plan
// (docs/demo/2026-10-05-api-rollout-plan.md). Calls only getMe, getChat, getChatMember and
// getWebhookInfo: no message, webhook change or update read.
//
//   node --env-file=<repo>/.env scripts/rollout/telegram.mjs <telegram_chat_id> <admin_user_id>
//
// The chat and admin ids come from the db.mjs precheck. The token is read from
// TELEGRAM_BOT_TOKEN and never printed; it is part of every request URL, so errors print only
// the method name and the network error code.
const BOT_USERNAME = "hyphaeprotocol_bot";
const WEBHOOK_URL = "https://hyphae-api.fly.dev/telegram";

const [chatId, adminId] = process.argv.slice(2);
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!chatId || !adminId || !token) {
  console.error(
    "usage: TELEGRAM_BOT_TOKEN in env; telegram.mjs <telegram_chat_id> <admin_user_id>",
  );
  process.exit(1);
}

async function call(method, params = {}) {
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    throw new Error(`${method} network error ${err?.cause?.code ?? "unknown"}`);
  }
  const body = await res.json().catch(() => ({}));
  if (!body.ok) throw new Error(`${method} failed: ${res.status} ${body.description ?? ""}`);
  return body.result;
}

const problems = [];
const me = await call("getMe");
if (me.username !== BOT_USERNAME) problems.push(`bot is @${me.username}`);
const chat = await call("getChat", { chat_id: chatId });
const botMember = await call("getChatMember", { chat_id: chatId, user_id: me.id });
if (!["member", "administrator"].includes(botMember.status))
  problems.push(`bot status in chat is ${botMember.status}`);
const admin = await call("getChatMember", { chat_id: chatId, user_id: adminId });
if (!["creator", "administrator"].includes(admin.status))
  problems.push(`designated admin status is ${admin.status}`);
const hook = await call("getWebhookInfo");
if (hook.url !== WEBHOOK_URL) problems.push("webhook URL differs");
if (hook.last_error_message) problems.push("webhook reports a last error");

const report = {
  verdict: problems.length ? "FAIL" : "PASS",
  problems,
  bot: { id: me.id, username: me.username },
  chat: { type: chat.type, title: chat.title },
  bot_status: botMember.status,
  admin_status: admin.status,
  webhook: {
    url_matches: hook.url === WEBHOOK_URL,
    pending_update_count: hook.pending_update_count,
    last_error_date: hook.last_error_date
      ? new Date(hook.last_error_date * 1000).toISOString()
      : null,
    last_error_message: hook.last_error_message ?? null,
  },
};
console.log(JSON.stringify(report, null, 2));
process.exit(problems.length ? 1 : 0);
