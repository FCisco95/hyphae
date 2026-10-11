import { setTimeout } from "node:timers/promises";
import type { Db } from "@hyphae/db";
import { type Api, InlineKeyboard } from "grammy";
import { isMemberStatus } from "../bot/membership.js";
import { engageLinks } from "../x/intents.js";
import { claimRaidAlert, deliverRaidAlert } from "./alerts.js";
import { claimRaidRecap, deliverRaidRecap } from "./recap.js";

// One private alert and one group recap per second per API process. Outbox claims serialize
// concurrent processes; Telegram 429 responses defer retry. No scoring/reward worker or pg-boss
// queue is changed.
export function startRaidNotifier(db: Db, api: Api, webBase: string) {
  const controller = new AbortController();
  const done = (async () => {
    while (!controller.signal.aborted) {
      try {
        const row = await claimRaidAlert(db);
        if (row) {
          const status = await deliverRaidAlert(db, row.id, {
            membership: async (chat, user) =>
              isMemberStatus(
                await api.getChatMember(
                  Number(chat),
                  Number(user),
                  AbortSignal.timeout(4_000) as unknown as Parameters<Api["getChatMember"]>[2],
                ),
              ),
            send: (user, text, target, stop, taskId) =>
              api.sendMessage(
                Number(user),
                text,
                {
                  link_preview_options: { is_disabled: true },
                  reply_markup: engageLinks(target)
                    .reduce((kb, link) => kb.url(link.label, link.url), new InlineKeyboard())
                    .row()
                    .text("Submit my reply", `raid_reply_${taskId}`)
                    .text("Submit my quote", `raid_quote_${taskId}`)
                    .row()
                    .text("Stop these alerts", stop),
                },
                AbortSignal.timeout(4_000) as unknown as Parameters<Api["sendMessage"]>[3],
              ),
          });
          console.log(JSON.stringify({ notifier: "raid", status }));
        }
      } catch {
        // Driver/Telegram errors can contain credentials; save/log only bounded outcome codes.
        console.error("raid-notifier: operation failed; check delivery state and connectivity");
      }
      try {
        const recap = await claimRaidRecap(db, webBase);
        if (recap) {
          const status = await deliverRaidRecap(db, recap, {
            send: (chat, text) =>
              api.sendMessage(
                Number(chat),
                text,
                { link_preview_options: { is_disabled: true } },
                AbortSignal.timeout(4_000) as unknown as Parameters<Api["sendMessage"]>[3],
              ),
          });
          console.log(JSON.stringify({ notifier: "recap", status }));
        }
      } catch {
        console.error("raid-notifier: recap failed; check raid_recaps and connectivity");
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
