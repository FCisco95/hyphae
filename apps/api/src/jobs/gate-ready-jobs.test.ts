import { beforeEach, describe, expect, it, vi } from "vitest";
import { toGateReadyJob } from "../payout/gate-ready.js";

// The worker's delivery wires the queued job to current state: it must send what the epoch's
// current note says, and nothing when it has none. Everything outside the wiring is replaced.
const { sendMessage, currentGateReadyNote } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  currentGateReadyNote: vi.fn(),
}));
vi.mock("../bot/index.js", () => ({ bot: { token: "t".repeat(30), api: { sendMessage } } }));
vi.mock("../db.js", () => ({ db: {} }));
vi.mock("../env.js", () => ({ env: {} }));
vi.mock("../payout/settle-chain.js", () => ({
  settleChainFromEnv: () => async () => ({ chain: true }),
}));
vi.mock("../payout/gate-ready.js", async (original) => ({
  ...(await original<typeof import("../payout/gate-ready.js")>()),
  currentGateReadyNote,
}));

const queued = toGateReadyJob({
  communityId: "c",
  epochId: "e",
  communityName: "Hyphae Ready",
  mint: "M",
  epochIndex: 1,
  payable: 3,
  topUpLamports: 600_000_000n,
  adminTelegramUserId: 42n,
  outcome: "rolled_over",
});

beforeEach(() => {
  sendMessage.mockReset();
  currentGateReadyNote.mockReset();
});

describe("deliverGateReadyJob", () => {
  it("sends nothing when the epoch has no current note, whatever was queued", async () => {
    currentGateReadyNote.mockResolvedValue(null);
    const { deliverGateReadyJob } = await import("./gate-ready-jobs.js");
    await deliverGateReadyJob(queued);
    expect(currentGateReadyNote).toHaveBeenCalledWith(
      {},
      { chain: true },
      { communityId: "c", epochId: "e" },
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends the current note's text to the admin, not the queued snapshot", async () => {
    currentGateReadyNote.mockResolvedValue({
      communityId: "c",
      epochId: "e",
      communityName: "Hyphae Ready",
      mint: "M",
      epochIndex: 2,
      payable: 9,
      topUpLamports: 0n,
      adminTelegramUserId: 42n,
      outcome: "planned",
    });
    const { deliverGateReadyJob } = await import("./gate-ready-jobs.js");
    await deliverGateReadyJob(queued);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [chat, text] = sendMessage.mock.calls[0] as [number, string];
    expect(chat).toBe(42);
    expect(text).toContain("epoch 2");
    expect(text).toContain("9 payable");
    expect(text).not.toContain("rolled over");
  });
});
