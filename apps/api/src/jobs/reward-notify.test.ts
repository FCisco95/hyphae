import { inspect } from "node:util";
import { HttpError } from "grammy";
import { describe, expect, it, vi } from "vitest";

const TOKEN = "1234567890:AAH-worker-token-that-must-never-be-stored";
const m = vi.hoisted(() => ({ marked: [] as string[] }));

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
// grammY keeps node-fetch's network error, whose message is the request URL with the token.
vi.mock("../bot/index.js", () => ({
  bot: {
    token: TOKEN,
    api: {
      sendMessage: async () => {
        throw new HttpError(
          "Network request for 'sendMessage' failed!",
          new Error(`request to https://api.telegram.org/bot${TOKEN}/sendMessage failed`),
        );
      },
    },
  },
}));

const { notifyReward } = await import("./reward-jobs.js");

describe("notifyReward", () => {
  it("fails a job whose message cannot be sent without handing pg-boss the token, and stays retryable", async () => {
    const err = await notifyReward({
      communityId: "c1",
      contributionId: "k1",
      decisionId: "d1",
      text: "scored",
    }).then(
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
});
