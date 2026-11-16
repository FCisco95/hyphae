import {
  fromGateReadyJob,
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

// The queued note is a snapshot: before it is sent, the epoch must still wait as it says, or an
// operator could follow a stale instruction (run publishes the next epoch, not this one).
export async function deliverGateReady(
  job: GateReadyJob,
  send: (chatId: bigint, text: string) => Promise<void>,
  stillPending: (ref: { communityId: string; epochId: string }) => Promise<boolean>,
): Promise<"sent" | "stale"> {
  const note = fromGateReadyJob(job);
  if (!(await stillPending({ communityId: note.communityId, epochId: note.epochId }))) {
    return "stale";
  }
  await send(note.adminTelegramUserId, gateReadyText(note));
  return "sent";
}
