import { inspect } from "node:util";
import type { PayoutVerdictV1 } from "@hyphae/core";
import { HttpError } from "grammy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "1234567890:AAH-worker-token-that-must-never-be-stored";
const m = vi.hoisted(() => ({
  marked: [] as string[],
  sent: [] as { text: string; other: Record<string, unknown> }[],
  fail: false,
  hint: null as PayoutVerdictV1 | null,
}));

vi.mock("../env.js", () => ({ env: { PUBLIC_WEB_URL: "https://hyphae.test" } }));
vi.mock("../scoring/default-model.js", () => ({ defaultModel: { id: "test" } }));
vi.mock("./queue.js", () => ({ QUEUES: {}, boss: {} }));
vi.mock("../db.js", () => ({
  db: {
    select: () => ({
      from: () => ({ innerJoin: () => ({ where: async () => [{ chatId: -100n, messageId: 5 }] }) }),
    }),
  },
}));
vi.mock("../rewards/recovery.js", () => ({
  strandedWork: async () => ({ evaluations: [], retrievals: [], notifications: [] }),
  decisionNotified: async () => false,
  markNotified: async (_db: unknown, id: string) => {
    m.marked.push(id);
  },
}));
vi.mock("./payout-hint.js", () => ({ scoreHint: async () => m.hint }));
// grammY keeps node-fetch's network error, whose message is the request URL with the token.
vi.mock("../bot/index.js", () => ({
  bot: {
    token: TOKEN,
    isInited: () => true,
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

beforeEach(() => {
  m.marked = [];
  m.sent = [];
  m.fail = false;
  m.hint = null;
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

  it("adds what a member still needs to be paid, with a button to the next step", async () => {
    m.hint = {
      status: "not_payable",
      reasons: ["no_verified_wallet", "no_rules_test"],
      hold: "at_close",
    };
    await notifyReward(job);
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]?.text).toBe(
      "scored\nNot payable yet: link a wallet by signing and pass the rules test before the epoch closes.",
    );
    expect(m.sent[0]?.other.reply_markup).toEqual({
      inline_keyboard: [[{ text: "Link my wallet", url: "https://t.me/t_bot?start=link_c1" }]],
    });
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
