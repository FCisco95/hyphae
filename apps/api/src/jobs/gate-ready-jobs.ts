import { telegramCall } from "../bot/errors.js";
import { bot } from "../bot/index.js";
import { db } from "../db.js";
import { env } from "../env.js";
import { currentGateReadyNote, type GateReadyJob } from "../payout/gate-ready.js";
import { deliverGateReady } from "../payout/gate-ready-notify.js";
import { settleChainFromEnv } from "../payout/settle-chain.js";

// Built once per process, like the settle job's: null without a read RPC, and then no message can
// be checked, so none is sent.
const chainOf = settleChainFromEnv(env);

// Sends the gate-ready message to the community admin in a private chat, rebuilt from the
// epoch's current state (a queued snapshot may be stale). A failure is thrown to the queue, which
// does not retry (it could send the message twice); the epoch's job id keeps it from being
// queued again.
export async function deliverGateReadyJob(job: GateReadyJob): Promise<void> {
  const status = await deliverGateReady(
    job,
    (chatId, text) =>
      telegramCall(bot.token, async () => {
        await bot.api.sendMessage(Number(chatId), text, {
          link_preview_options: { is_disabled: true },
        });
      }),
    async (queued) =>
      chainOf
        ? currentGateReadyNote(db, await chainOf(), {
            communityId: queued.communityId,
            epochId: queued.epochId,
          })
        : null,
  );
  console.log(JSON.stringify({ job: "gate-ready", epochId: job.epochId, status }));
}
