import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sent: [] as { queue: string; data: unknown }[],
  runs: [] as unknown[],
  checker: async () => ({ kind: "uncertain", reason: "not_configured" }) as const,
  settles: (async () => 0) as () => Promise<number>,
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
vi.mock("./settle-jobs.js", () => ({ enqueueDueSettles: () => m.settles() }));
vi.mock("../rewards/copy.js", () => ({
  openCopyEpochs: async () => [],
  reconcileEpoch: async () => undefined,
}));
vi.mock("../rewards/recovery.js", () => ({
  strandedWork: async () => ({ evaluations: [], retrievals: [], notifications: [] }),
  decisionNotified: async () => false,
  decisionSuperseded: async () => false,
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
  m.settles = async () => 0;
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

  // Deploy order: an image with the settle loop may run before migration 0023 is applied. The
  // settle enqueue then fails on the missing tables, and the rest of the sweep (closes, hold
  // checks, stranded work) must run exactly as before.
  it("the recovery sweep logs a failing settle enqueue and still sends its other work", async () => {
    m.settles = async () => {
      throw new Error('relation "payout_policies" does not exist');
    };
    const errors: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    try {
      await expect(recoverRewardWork()).resolves.toBeUndefined();
    } finally {
      console.error = original;
    }
    expect(m.sent).toEqual([{ queue: "hold-check", data: { communityId: "c1", epochId: "e9" } }]);
    expect(errors.map((e) => String(e[0]))).toEqual([
      expect.stringContaining('"settles":"failed"'),
    ]);
    expect(String(errors[0]?.[0])).toContain("payout_policies");
  });

  it("a hold-check job runs the checks with the process's checker", async () => {
    await checkEpochHolds({ communityId: "c1", epochId: "e1" });
    expect(m.runs).toEqual([
      { db: { tag: "db" }, ref: { communityId: "c1", epochId: "e1" }, check: m.checker },
    ]);
  });
});
