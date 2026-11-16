import {
  type GateReadyJob,
  type GateReadyNote,
  gateReadyJobId,
  gateReadyText,
  toGateReadyJob,
} from "./gate-ready.js";

// The queue's options. The queue refuses a job id it still holds, so completed jobs are kept for
// good (deleteAfterSeconds 0): that is what makes a restart unable to queue a message twice. No
// retry: a handler that fails after Telegram accepted the message would send it again. At most
// once: a lost message shows in the logs, a repeated one cannot be taken back.
export const GATE_READY_QUEUE_OPTIONS = {
  retryLimit: 0,
  expireInSeconds: 60,
  deleteAfterSeconds: 0,
} as const;

// Queueing and delivery of the gate-ready message, with the queue and Telegram injected.

// The queue refuses an id it already holds (completed jobs are kept, see queue.ts), so a note
// queued once is never queued again. Returns how many the queue accepted.
export async function queueGateReady(
  notes: readonly GateReadyNote[],
  send: (job: GateReadyJob, opts: { id: string }) => Promise<string | null>,
): Promise<number> {
  let queued = 0;
  for (const note of notes) {
    if ((await send(toGateReadyJob(note), { id: gateReadyJobId(note.epochId) })) !== null) {
      queued += 1;
    }
  }
  return queued;
}

// The queued note is a snapshot, so the message is rebuilt from current state when it is sent:
// `current` returns the epoch note as things stand now, or null when it has none (published,
// superseded, held), and then nothing is sent.
export async function deliverGateReady(
  job: GateReadyJob,
  send: (chatId: bigint, text: string) => Promise<void>,
  current: (job: GateReadyJob) => Promise<GateReadyNote | null>,
): Promise<"sent" | "stale"> {
  const note = await current(job);
  if (note === null) return "stale";
  await send(note.adminTelegramUserId, gateReadyText(note));
  return "sent";
}
