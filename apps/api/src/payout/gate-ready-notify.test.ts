import { describe, expect, it } from "vitest";
import { gateReadyJobId, toGateReadyJob } from "./gate-ready.js";
import { deliverGateReady, GATE_READY_QUEUE_OPTIONS, queueGateReady } from "./gate-ready-notify.js";

const note = {
  communityId: "c",
  epochId: "5f1c1f66-8f7c-4f0e-9a3a-1c2d3e4f5a6b",
  communityName: "Hyphae Ready",
  mint: "M",
  epochIndex: 2,
  payable: 4,
  topUpLamports: 0n,
  adminTelegramUserId: 42n,
  outcome: "planned" as const,
};

describe("queueGateReady", () => {
  it("queues each note under the id of its epoch", async () => {
    const seen: { id: string }[] = [];
    const queued = await queueGateReady([note], async (_job, opts) => {
      seen.push(opts);
      return "job";
    });
    expect(queued).toBe(1);
    expect(seen).toEqual([{ id: gateReadyJobId(note.epochId) }]);
  });

  it("counts only the notes the queue accepted, so a restart queues none twice", async () => {
    const taken = new Set<string>();
    const send = async (_job: unknown, opts: { id: string }) => {
      if (taken.has(opts.id)) return null;
      taken.add(opts.id);
      return opts.id;
    };
    expect(await queueGateReady([note], send)).toBe(1);
    expect(await queueGateReady([note], send)).toBe(0);
  });
});

describe("deliverGateReady", () => {
  it("sends the current note, not the queued snapshot", async () => {
    const sent: [bigint, string][] = [];
    const out = await deliverGateReady(
      toGateReadyJob(note),
      async (chat, text) => {
        sent.push([chat, text]);
      },
      async (job) => {
        expect(job.epochId).toBe(note.epochId);
        return { ...note, epochIndex: 9, payable: 7 };
      },
    );
    expect(out).toBe("sent");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.[0]).toBe(42n);
    expect(sent[0]?.[1]).toContain("epoch 9");
    expect(sent[0]?.[1]).toContain("7 payable");
  });

  it("sends nothing when the epoch no longer has a current note", async () => {
    const sent: string[] = [];
    const out = await deliverGateReady(
      toGateReadyJob(note),
      async (_chat, text) => {
        sent.push(text);
      },
      async () => null,
    );
    expect(out).toBe("stale");
    expect(sent).toEqual([]);
  });
});

describe("GATE_READY_QUEUE_OPTIONS", () => {
  it("never retries (a retry would send the message twice) and keeps finished jobs for good", () => {
    expect(GATE_READY_QUEUE_OPTIONS.retryLimit).toBe(0);
    expect(GATE_READY_QUEUE_OPTIONS.deleteAfterSeconds).toBe(0);
  });
});
