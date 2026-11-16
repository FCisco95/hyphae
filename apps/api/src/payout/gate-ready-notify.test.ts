import { describe, expect, it } from "vitest";
import { gateReadyJobId, toGateReadyJob } from "./gate-ready.js";
import { deliverGateReady, queueGateReady } from "./gate-ready-notify.js";

const note = {
  communityId: "c",
  epochId: "5f1c1f66-8f7c-4f0e-9a3a-1c2d3e4f5a6b",
  communityName: "Hyphae Ready",
  mint: "M",
  epochIndex: 2,
  payable: 4,
  topUpLamports: 0n,
  adminTelegramUserId: 42n,
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
  it("messages the community admin with the text", async () => {
    const sent: [bigint, string][] = [];
    await deliverGateReady(toGateReadyJob(note), async (chat, text) => {
      sent.push([chat, text]);
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.[0]).toBe(42n);
    expect(sent[0]?.[1]).toContain("epoch 2 is ready to pay");
  });
});
