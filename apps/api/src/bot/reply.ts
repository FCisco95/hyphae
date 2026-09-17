import type { Context } from "grammy";

// Every bot answer replies to the triggering message so group threads stay readable.
export const reply = (ctx: Context, text: string) =>
  ctx.reply(text, {
    ...(ctx.msg ? { reply_parameters: { message_id: ctx.msg.message_id } } : {}),
    link_preview_options: { is_disabled: true },
  });
