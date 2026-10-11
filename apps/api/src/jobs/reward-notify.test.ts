import { inspect } from "node:util";
import { HttpError } from "grammy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PayoutVerdictV1 } from "../payout/readiness.js";

const TOKEN = "1234567890:AAH-worker-token-that-must-never-be-stored";
const CLOSES_AT = new Date("2026-10-10T00:00:00.000Z");
const m = vi.hoisted(() => ({
  marked: [] as string[],
  sent: [] as { text: string; other: Record<string, unknown> }[],
  fail: false,
  hint: null as PayoutVerdictV1 | null,
  inited: true,
  init: async (_signal?: AbortSignal) => {},
  initSignals: [] as (AbortSignal | undefined)[],
}));

vi.mock("../env.js", () => ({ env: { PUBLIC_WEB_URL: "https://hyphae.test" } }));
vi.mock("../scoring/default-model.js", () => ({ defaultModel: { id: "test" } }));
vi.mock("./queue.js", () => ({ QUEUES: {}, boss: {} }));
vi.mock("../db.js", () => {
  const tx = { transaction: async (fn: (t: unknown) => unknown) => fn(tx) };
  return {
    db: {
      select: () => ({
        from: () => ({
          innerJoin: () => ({ where: async () => [{ chatId: -100n, messageId: 5 }] }),
        }),
      }),
      transaction: async (fn: (t: unknown) => unknown) => fn(tx),
    },
  };
});
vi.mock("../rewards/recovery.js", () => ({
  strandedWork: async () => ({ evaluations: [], retrievals: [], notifications: [] }),
  decisionNotified: async () => false,
  markNotified: async (_db: unknown, id: string) => {
    m.marked.push(id);
  },
}));
vi.mock("./payout-hint.js", () => ({
  lockScoreMessages: async () => {},
  scoreHint: async () => m.hint && { payout: m.hint, closesAt: CLOSES_AT },
}));
// grammY keeps node-fetch's network error, whose message is the request URL with the token.
vi.mock("../bot/index.js", () => ({
  bot: {
    token: TOKEN,
    isInited: () => m.inited,
    init: async (signal?: AbortSignal) => {
      m.initSignals.push(signal);
      await m.init(signal);
      m.inited = true;
    },
    botInfo: { username: "t_bot" },
    api: {
      sendMessage: async (_chat: number, text: string, other: Record<string, unknown>) => {
        if (m.fail) {
          throw new HttpError(
            "Network request for 'sendMessage' failed!",
            new Error(`request to https://api.telegram.org/bot${TOKEN}/sendMessage failed`),
          );
        }
        m.sent.push({ text, other });
      },
    },
  },
}));

const { notifyReward } = await import("./reward-jobs.js");

const job = { communityId: "c1", contributionId: "k1", decisionId: "d1", text: "scored" };
const notYet: PayoutVerdictV1 = {
  status: "not_payable",
  reasons: ["no_verified_wallet", "no_rules_test"],
  hold: "at_close",
};

beforeEach(() => {
  m.marked = [];
  m.sent = [];
  m.fail = false;
  m.hint = null;
  m.inited = true;
  m.init = async () => {};
  m.initSignals = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date(CLOSES_AT.getTime() - 3_600_000));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("notifyReward", () => {
  it("fails a job whose message cannot be sent without handing pg-boss the token, and stays retryable", async () => {
    m.fail = true;
    const err = await notifyReward(job).then(
      () => null,
      (e: unknown) => e as Error,
    );
    // pg-boss serializes a failed job's error, nested errors included, into the job's row.
    expect(err).toBeInstanceOf(Error);
    expect(err?.cause).toBeUndefined();
    expect(inspect(err, { depth: null })).not.toContain(TOKEN);
    expect(JSON.stringify(err, Object.getOwnPropertyNames(err))).not.toContain(TOKEN);
    expect(m.marked).toEqual([]);
  });

  it("keeps a member's eligibility off group score messages", async () => {
    m.hint = notYet;
    await notifyReward(job);
    expect(m.sent.map((s) => [s.text, s.other.reply_markup])).toEqual([["scored", undefined]]);
    expect(m.marked).toEqual(["d1"]);
  });

  it("sends the score alone when there is no hint, or nothing a link can fix", async () => {
    await notifyReward(job);
    m.hint = { status: "held", reasons: ["hold_pending"], hold: "at_close" };
    await notifyReward(job);
    m.hint = { status: "not_payable", reasons: ["no_points"], hold: "at_close" };
    await notifyReward(job);
    expect(m.sent.map((s) => [s.text, s.other.reply_markup])).toEqual([
      ["scored", undefined],
      ["scored", undefined],
      ["scored", undefined],
    ]);
  });

  it("asks no status for a message without a decision", async () => {
    m.hint = { status: "not_payable", reasons: ["no_rules_test"], hold: "at_close" };
    await notifyReward({ communityId: "c1", contributionId: "k1", text: "waiting" });
    expect(m.sent.map((s) => s.text)).toEqual(["waiting"]);
  });
});

describe("notifyReward without bot initialization", () => {
  it("does not fetch a username or an eligibility checklist for a group score", async () => {
    m.hint = notYet;
    m.inited = false;
    m.init = async () => {
      throw new Error("must not initialize for a private hint");
    };
    await notifyReward(job);
    expect(m.initSignals).toEqual([]);
    expect(m.sent.map((s) => [s.text, s.other.reply_markup])).toEqual([["scored", undefined]]);
    expect(m.marked).toEqual(["d1"]);
  });
});
