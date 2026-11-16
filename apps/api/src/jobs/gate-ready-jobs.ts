import { telegramCall } from "../bot/errors.js";
import { bot } from "../bot/index.js";
import { db } from "../db.js";
import { epochStillPending, type GateReadyJob } from "../payout/gate-ready.js";
import { deliverGateReady } from "../payout/gate-ready-notify.js";

// Sends the queued gate-ready message to the community admin in a private chat. A failure is
// thrown to the queue, which retries once; the epoch's job id keeps it from being queued again.
export async function deliverGateReadyJob(job: GateReadyJob): Promise<void> {
  const status = await deliverGateReady(
    job,
    (chatId, text) =>
      telegramCall(bot.token, async () => {
        await bot.api.sendMessage(Number(chatId), text, {
          link_preview_options: { is_disabled: true },
        });
      }),
    (ref) => epochStillPending(db, ref),
  );
  console.log(JSON.stringify({ job: "gate-ready", epochId: job.epochId, status }));
}
