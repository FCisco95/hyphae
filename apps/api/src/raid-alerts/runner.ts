import { setTimeout } from "node:timers/promises";
import type { Db } from "@hyphae/db";
import { type Api, InlineKeyboard } from "grammy";
import { isMemberStatus } from "../bot/membership.js";
import { claimRaidAlert, deliverRaidAlert } from "./alerts.js";

// One message per second per API process. Outbox claims serialize concurrent processes;
// Telegram 429 responses defer retry. No scoring/reward worker or pg-boss queue is changed.
export function startRaidNotifier(db: Db, api: Api) {
  const controller = new AbortController();
  const done = (async () => {
    while (!controller.signal.aborted) {
      try {
        const row = await claimRaidAlert(db);
        if (row) {
          const status = await deliverRaidAlert(db, row.id, {
            membership: async (chat, user) =>
              isMemberStatus(await api.getChatMember(Number(chat), Number(user))),
            send: (user, text, target, stop, taskId) =>
              api.sendMessage(Number(user), text, {
                link_preview_options: { is_disabled: true },
                reply_markup: new InlineKeyboard()
                  .url("Engage on X", target)
                  .row()
                  .text("Submit my reply", `raid_reply_${taskId}`)
                  .text("Submit my quote", `raid_quote_${taskId}`)
                  .row()
                  .text("Stop these alerts", stop),
              }),
          });
          console.log(JSON.stringify({ notifier: "raid", status }));
        }
      } catch {
        // Driver/Telegram errors can contain credentials; save/log only bounded outcome codes.
        console.error("raid-notifier: operation failed; check delivery state and connectivity");
      }
      await setTimeout(1000, undefined, { signal: controller.signal }).catch(() => {});
    }
  })();
  return {
    stop: async () => {
      controller.abort();
      await done;
    },
  };
}
