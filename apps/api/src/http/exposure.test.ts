import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beginDispatch, markReconciliation } from "../rewards/evaluation.js";
import { admitContribution } from "../rewards/intake.js";
import { createTestDb } from "../rewards/test-db.js";
import { type AuditDemo, seedAuditDemo } from "./demo-seed.js";
import { readRoutes } from "./routes.js";

// The arc's stop rule as a test: no Telegram identifier, unverified wallet, private key material
// or model output that never became a decision may leave the read API.

const NOW = new Date("2026-11-20T12:00:00.000Z");
const HIDDEN_OUTPUT = "UNPUBLISHED_OUTPUT_7f3a";
const FORBIDDEN_KEY = /telegram|chat|message_id|idempotency|nonce|session|proof|artifact|digest/i;

let t: Awaited<ReturnType<typeof createTestDb>>;
let demo: AuditDemo;
let unfinished: string;
beforeAll(async () => {
  t = await createTestDb();
  demo = await seedAuditDemo(t.db, NOW);
  // A contribution whose model call returned output that never became a decision.
  const at = async () => new Date(NOW.getTime() - 60_000);
  const admitted = await admitContribution(
    t.db,
    {
      communityId: demo.communityId,
      memberId: demo.members.pasted,
      contribution: {
        kind: "text",
        url: null,
        text: "Unscored work.",
        oembed: null,
        telegramMessageId: 424242,
      },
      artifactKey: "text:sha256:exposure",
      idempotencyKey: "tg:-100555:424242",
      capture: { source: "telegram_text", capturedAt: NOW.toISOString(), limitations: [] },
    },
    { clock: at },
  );
  if (admitted.status !== "admitted") throw new Error(admitted.status);
  unfinished = admitted.intake.contributionId;
  const begun = await beginDispatch(
    t.db,
    { communityId: demo.communityId, target: { contributionId: unfinished }, model: "m" },
    { clock: at },
  );
  if (begun.status !== "begun") throw new Error(begun.status);
  await markReconciliation(
    t.db,
    {
      communityId: demo.communityId,
      dispatchId: begun.dispatch.id,
      error: "provider timeout",
      output: { score: 99, reasoning: HIDDEN_OUTPUT },
    },
    { clock: at },
  );
});
afterAll(async () => {
  await t.close();
});

function keys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) keys(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      keys(v, out);
    }
  }
  return out;
}

describe("read API data exposure", () => {
  it("serves nothing private from any route or any reachable contribution", async () => {
    const app = readRoutes({ db: t.db, clock: async () => NOW });
    const suffix = demo.mint.slice("DemoMint".length);
    const bodies: string[] = [];
    const fetchJson = async (path: string) => {
      const r = await app.request(path);
      expect(r.status, path).toBe(200);
      const text = await r.text();
      bodies.push(text);
      return JSON.parse(text);
    };

    await fetchJson(`/communities/${demo.mint}`);
    const ids = new Set<string>([unfinished]);
    for (const index of [1, 2]) {
      await fetchJson(`/communities/${demo.mint}/epochs/${index}`);
      await fetchJson(`/communities/${demo.mint}/leaderboard?epoch=${index}`);
      const list = await fetchJson(`/communities/${demo.mint}/epochs/${index}/contributions`);
      for (const c of list.contributions) ids.add(c.id);
    }
    expect(ids.size).toBe(8);
    for (const id of ids) await fetchJson(`/contributions/${id}`);
    // The record repeats no contribution link: an X link names the account that posted it.
    const record = await fetchJson(`/wallets/${demo.signedWallet}/record`);
    expect(JSON.stringify(record)).not.toContain("x.com");

    const all = bodies.join("\n");
    for (const secret of [
      "987654321987",
      "987654321988",
      "tg_secret_user",
      "tg_other_user",
      demo.pastedWallet,
      HIDDEN_OUTPUT,
      "provider timeout",
      `demo:${suffix}`,
      `demo-${suffix}`,
      "tg:-100555",
      "0".repeat(64),
    ]) {
      expect(all, secret).not.toContain(secret);
    }
    const allKeys = bodies.flatMap((b) => keys(JSON.parse(b)));
    expect(allKeys.filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
    expect(allKeys.filter((k) => k === "input" || k === "output")).toEqual([]);
    // The signed wallet is the one address that may appear.
    expect(all).toContain(demo.signedWallet);
  });
});
