import type { WebhookOptions } from "grammy";

// grammY's default answers 500 once an update takes over 10 s, and Telegram then redelivers it
// into handlers that are not idempotent (/raid, the hours picker). "return" answers 200 and lets
// the handler finish in the background.
export const webhookOptions = (secretToken: string): WebhookOptions => ({
  secretToken,
  onTimeout: "return",
});
