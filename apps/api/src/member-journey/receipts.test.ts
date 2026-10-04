import {
  contributions,
  epochs,
  leaves,
  raidLifecycleEvents,
  raidSubmissionReceipts,
  raidSubmissionSessions,
  rewardDecisions,
  submissionIssues,
  tasks,
} from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeEpoch } from "../rewards/close.js";
import { appendCorrection } from "../rewards/decisions.js";
import { beginDispatch, completeDispatch, runEvaluation } from "../rewards/evaluation.js";
import { admitContribution } from "../rewards/intake.js";
import {
  createTestDb,
  later,
  seedCommunity,
  seedRewardLane,
  seedTask,
  T0,
} from "../rewards/test-db.js";
import { loadReceipt, receiptText, reportSubmissionIssue } from "./receipts.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
const MIN = 60_000;
const WEEK = 7 * 86_400_000;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("missing fixture");
  return value;
}

async function lane() {
  const l = await seedRewardLane(t.db);
  const task = await seedTask(t.db, l.community.id, T0);
  const admitted = await admitContribution(
    t.db,
    {
      communityId: l.community.id,
      memberId: l.member.id,
      taskId: task.id,
      contribution: {
        kind: "reply",
        text: "My own target-specific reply",
        url: "https://x.com/member/status/77",
        telegramMessageId: 77,
      },
      artifactKey: "x:status:77",
      idempotencyKey: "private:77",
      capture: { source: "x_oembed", capturedAt: T0.toISOString(), limitations: ["text_only"] },
    },
    { clock: later(MIN) },
  );
  if (admitted.status !== "admitted") throw new Error(admitted.status);
  const session = required(
    (
      await t.db
        .insert(raidSubmissionSessions)
        .values({
          communityId: l.community.id,
          taskId: task.id,
          telegramUserId: l.member.telegramUserId,
          kind: "reply",
          expiresAt: new Date(T0.getTime() + 20 * MIN),
        })
        .returning()
    )[0],
  );
  const receipt = required(
    (
      await t.db
        .insert(raidSubmissionReceipts)
        .values({
          sessionId: session.id,
          communityId: l.community.id,
          memberId: l.member.id,
          taskId: task.id,
          contributionId: admitted.intake.contributionId,
          artifactKey: "x:status:77",
        })
        .returning()
    )[0],
  );
  const read = (ms = 10 * MIN) =>
    loadReceipt(t.db, receipt.id, l.member.telegramUserId, { clock: later(ms) });
  const issue = (
    messageId = 80,
    user = l.member.telegramUserId,
    text = "My target-specific explanation was missed",
  ) =>
    reportSubmissionIssue(t.db, {
      receiptId: receipt.id,
      telegramUserId: user,
      telegramMessageId: messageId,
      text,
    });
  return { ...l, task, receipt, intake: admitted.intake, read, issue };
}

const quality = (score: number) => ({
  score,
  rubricHits: [{ key: "context_fit", met: true, note: "specific" }],
  flags: [],
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "Specific to the selected target.",
});

describe("private member receipts", () => {
  it("scopes receipt reads and disputes to the original caller and rejects malformed IDs", async () => {
    const l = await lane();
    expect(await loadReceipt(t.db, l.receipt.id, 43n)).toBeNull();
    expect(await loadReceipt(t.db, "invalid", 42n)).toBeNull();
    expect(await l.issue(80, 43n)).toEqual({ status: "not_found" });
    const row = required(await l.read());
    expect(row.task.id).toBe(l.task.id);
    const text = receiptText(row, "https://hyphae.test");
    expect(text).toContain("Pending scoring");
    expect(text).toContain("Target relation: unverified");
    expect(text).toContain("X account ownership: unverified");
    expect(text).toContain(`/x/${l.intake.contributionId}`);
    expect(text).toContain("Payment: not verified here");
    expect(text).not.toContain("Paid");
  });

  it("fails closed on cross-community receipt links even for a Telegram user in both communities", async () => {
    const l = await lane();
    const other = await seedCommunity(t.db);
    await t.db
      .update(raidSubmissionReceipts)
      .set({ memberId: other.member.id })
      .where(eq(raidSubmissionReceipts.id, l.receipt.id));
    expect(await l.read()).toBeNull();
    expect(await l.issue()).toEqual({ status: "not_found" });
  });

  it("shows provisional points and the credited reason without claiming payout eligibility", async () => {
    const l = await lane();
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: l.intake.contributionId } },
      {
        model: "test:fixture",
        clock: later(2 * MIN),
        horizonMs: MIN,
        call: async () => ({ output: quality(85), latencyMs: 1, costMicroUsd: 1 }),
      },
    );
    const text = receiptText(required(await l.read()));
    expect(text).toContain("85 provisional");
    expect(text).toContain("Scored: quality 85/100");
    expect(text).toContain("payout eligibility is separate");
    expect(text).toContain("Specific to the selected target");
    expect(text).toContain("Points are not SOL");
  });

  it("keeps long Unicode receipts within Telegram's message limit with audit and issue controls intact", async () => {
    const l = await lane();
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: l.intake.contributionId } },
      {
        model: "test:fixture",
        clock: later(2 * MIN),
        horizonMs: MIN,
        call: async () => ({ output: quality(85), latencyMs: 1, costMicroUsd: 1 }),
      },
    );
    const row = required(await l.read());
    const audit = required(row.audit);
    const selected = required(audit.selected);
    const long = "🌱".repeat(5_000);
    const text = receiptText(
      {
        ...row,
        community: { ...row.community, name: long },
        task: { ...row.task, targetUrl: long },
        contribution: { ...row.contribution, url: long },
        audit: { ...audit, selected: { ...selected, explanation: long } },
      },
      "https://hyphae.test",
    );
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toContain(`/x/${row.receipt.contributionId}`);
    expect(text).toContain(`/issue ${row.receipt.id}`);
    expect(text).toContain("Payment: not verified here");
    expect(text).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u,
    );
  });

  it("retains frozen exclusion after a late score and issue report", async () => {
    const l = await lane();
    const begun = await beginDispatch(
      t.db,
      {
        communityId: l.community.id,
        target: { contributionId: l.intake.contributionId },
        model: "test:fixture",
      },
      { clock: later(2 * MIN) },
    );
    if (begun.status !== "begun") throw new Error(begun.status);
    await closeEpoch(
      t.db,
      { communityId: l.community.id, epochId: l.intake.epochId },
      { clock: later(WEEK + MIN) },
    );
    await completeDispatch(
      t.db,
      {
        communityId: l.community.id,
        dispatchId: begun.dispatch.id,
        fence: begun.dispatch.fence,
        output: quality(85),
        latencyMs: 1,
        costMicroUsd: 1,
      },
      { clock: later(WEEK + 2 * MIN) },
    );
    const before = required(await l.read(WEEK + 3 * MIN));
    expect(before.audit).toMatchObject({
      state: "pending_reconciliation",
      selected: null,
      epoch: { final: true },
    });
    const decisions = await t.db
      .select()
      .from(rewardDecisions)
      .where(eq(rewardDecisions.contributionId, l.intake.contributionId));
    await l.issue();
    expect(
      await t.db
        .select()
        .from(rewardDecisions)
        .where(eq(rewardDecisions.contributionId, l.intake.contributionId)),
    ).toEqual(decisions);
    const text = receiptText(required(await l.read(WEEK + 4 * MIN)));
    expect(text).toContain("Excluded from this epoch's points");
    expect(text).toContain("frozen result is preserved");
    expect(text).toContain("Scored after cutoff: revision 1, quality 85/100");
    expect(text).not.toContain("85 provisional");
    expect(text).not.toContain("85 frozen");
  });

  it("explains a scored zero-point result as excluded from positive credit, not pending", async () => {
    const l = await lane();
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: l.intake.contributionId } },
      {
        model: "test:fixture",
        clock: later(2 * MIN),
        horizonMs: MIN,
        call: async () => ({ output: quality(59), latencyMs: 1, costMicroUsd: 1 }),
      },
    );
    const text = receiptText(required(await l.read()));
    expect(text).toContain("quality 0/100 (raw 59)");
    expect(text).toContain("excluded from positive point credit (zero points)");
    expect(text).toContain("Quality was below the minimum credit floor");
    expect(text).not.toContain("Pending scoring");
  });

  it("records one append-only issue for duplicate retries and preserves the original report", async () => {
    const l = await lane();
    const first = await l.issue();
    const retry = await l.issue(80, 42n, "Changed retry cannot overwrite the original");
    expect(first.status).toBe("recorded");
    expect(retry).toEqual({ ...first, status: "duplicate" });
    expect(
      await t.db
        .select()
        .from(submissionIssues)
        .where(eq(submissionIssues.receiptId, l.receipt.id)),
    ).toMatchObject([
      {
        communityId: l.community.id,
        memberId: l.member.id,
        text: "My target-specific explanation was missed",
      },
    ]);
    expect(await l.issue(81, 42n, " ")).toEqual({ status: "invalid" });
    expect(await l.issue(81, 42n, "a".repeat(1001))).toEqual({ status: "invalid" });
  });

  it("shows the frozen selected revision even when a later correction has different points", async () => {
    const l = await lane();
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: l.intake.contributionId } },
      {
        model: "test:fixture",
        clock: later(2 * MIN),
        horizonMs: MIN,
        call: async () => ({ output: quality(85), latencyMs: 1, costMicroUsd: 1 }),
      },
    );
    await closeEpoch(
      t.db,
      { communityId: l.community.id, epochId: l.intake.epochId },
      { clock: later(WEEK + MIN) },
    );
    await appendCorrection(
      t.db,
      {
        communityId: l.community.id,
        contributionId: l.intake.contributionId,
        expectedRevision: 1,
        changes: { rawQuality: 95 },
        reason: "Late explanatory correction",
        actor: "test:operator",
        evidenceRefs: ["test:late-evidence"],
        idempotencyKey: "test:late-correction",
      },
      { clock: later(WEEK + 2 * MIN) },
    );
    const row = required(await l.read(WEEK + 3 * MIN));
    expect(row.audit).toMatchObject({
      selected: { revision: 1, points: "85" },
      epoch: { final: true },
    });
    expect(row.audit?.revisions.at(-1)).toMatchObject({ status: "late", points: "95" });
    expect(receiptText(row)).toContain("85 frozen");
    expect(receiptText(row)).not.toContain("95 frozen");
  });

  it("retains receipt and issue access after raid expiry, closure and cancellation", async () => {
    const l = await lane();
    expect(required(await l.read(49 * 3_600_000)).raidState).toBe("expired");
    await t.db.update(tasks).set({ status: "closed" }).where(eq(tasks.id, l.task.id));
    expect(required(await l.read()).raidState).toBe("closed");
    await t.db.insert(raidLifecycleEvents).values({
      communityId: l.community.id,
      taskId: l.task.id,
      actorTelegramUserId: 7n,
      action: "cancelled",
      reason: "Target no longer appropriate",
      telegramMessageId: 88,
    });
    expect(required(await l.read()).raidState).toBe("cancelled");
    expect((await l.issue()).status).toBe("recorded");
    expect(
      await t.db.select().from(contributions).where(eq(contributions.id, l.intake.contributionId)),
    ).toHaveLength(1);
  });

  it("does not infer claimability or payment from a root, allocation or cached claim transaction", async () => {
    const l = await lane();
    await t.db
      .update(epochs)
      .set({ root: "a".repeat(64), publishTx: "claimed-publication" })
      .where(eq(epochs.id, l.intake.epochId));
    await t.db.insert(leaves).values({
      epochId: l.intake.epochId,
      memberId: l.member.id,
      wallet: l.member.wallet,
      score: 85n,
      amountLamports: 10n,
      evidenceHash: "b".repeat(64),
      proof: [],
      claimTx: "cached-claim",
    });
    const text = receiptText(required(await l.read()));
    expect(text).toContain("Recorded allocation for your whole epoch: 10 lamports");
    expect(text).toContain("Claimability: not checked here");
    expect(text).toContain("Payment: not verified here");
    expect(text).not.toContain("cached-claim");
  });
});
