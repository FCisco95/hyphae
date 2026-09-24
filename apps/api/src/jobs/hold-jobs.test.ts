import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sent: [] as { queue: string; data: unknown }[],
  runs: [] as unknown[],
  checker: async () => ({ kind: "uncertain", reason: "not_configured" }) as const,
}));
vi.mock("../db.js", () => ({ db: { tag: "db" } }));
vi.mock("../env.js", () => ({
  env: { PUBLIC_WEB_URL: "https://hyphae.test", HOLD_RPC_HELIUS_URL: undefined },
}));
vi.mock("../bot/index.js", () => ({ bot: {} }));
vi.mock("../scoring/default-model.js", () => ({ defaultModel: { id: "test" } }));
vi.mock("./queue.js", () => ({
  QUEUES: {
    rewardClose: "reward-close",
    rewardEvaluation: "reward-evaluation",
    rewardRetrieval: "reward-retrieval",
    rewardNotify: "reward-notify",
    holdCheck: "hold-check",
  },
  boss: {
    send: async (queue: string, data: unknown) => {
      m.sent.push({ queue, data });
      return "job";
    },
  },
}));
vi.mock("../rewards/close.js", () => ({
  closeEpoch: async () => ({ status: "closed", created: true, entries: [] }),
  dueCloses: async () => [],
}));
vi.mock("../rewards/recovery.js", () => ({
  strandedWork: async () => ({ evaluations: [], retrievals: [], notifications: [] }),
  decisionNotified: async () => false,
  markNotified: async () => undefined,
}));
vi.mock("../payout/hold-gate.js", () => ({
  holdCheckerFromEnv: () => m.checker,
  dueHoldChecks: async () => [{ communityId: "c1", epochId: "e9" }],
  runHoldChecks: async (db: unknown, ref: unknown, deps: { check: unknown }) => {
    m.runs.push({ db, ref, check: deps.check });
    return { status: "checked", holder: 1, below: 0, uncertain: 0 };
  },
}));

const { checkEpochHolds, closeRewardEpoch, recoverRewardWork } = await import("./reward-jobs.js");

beforeEach(() => {
  m.sent = [];
  m.runs = [];
});

describe("hold-check jobs", () => {
  it("a close sends a hold check for the closed epoch", async () => {
    await closeRewardEpoch({ communityId: "c1", epochId: "e1" });
    expect(m.sent).toEqual([{ queue: "hold-check", data: { communityId: "c1", epochId: "e1" } }]);
  });

  it("the recovery sweep re-sends every due hold check", async () => {
    await recoverRewardWork();
    expect(m.sent).toEqual([{ queue: "hold-check", data: { communityId: "c1", epochId: "e9" } }]);
  });

  it("a hold-check job runs the checks with the process's checker", async () => {
    await checkEpochHolds({ communityId: "c1", epochId: "e1" });
    expect(m.runs).toEqual([
      { db: { tag: "db" }, ref: { communityId: "c1", epochId: "e1" }, check: m.checker },
    ]);
  });
});
