import { canonicalJson, sha256Hex } from "@hyphae/core";
import { rewardDecisions, rewardDispatches } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claudeTransport } from "../scoring/claude-client.js";
import { CLAUDE_MODEL } from "../scoring/claude-questions.js";
import { CLAUDE_REGISTRY } from "../scoring/claude-registry.js";
import { QUESTIONS_V4 } from "../scoring/jev-questions.js";
import type { JevScorerDef, JevTransport } from "../scoring/scorers.js";
import { buildRewardConfigPayload } from "./config.js";
import { type EvaluationDeps, recordNotSentProven, runEvaluation } from "./evaluation.js";
import { createTestDb, later, rubric, seedRewardLane } from "./test-db.js";

const MIN = 60_000;
const def = CLAUDE_REGISTRY.get("reward-eval/3") as JevScorerDef;
const IDS = [
  ...Object.keys(QUESTIONS_V4.gates),
  "ai_slop",
  "ai_slop_obvious",
  "polished",
  ...Object.keys(QUESTIONS_V4.bonuses),
];

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

// What the Messages API returns: the answers as one JSON text block, priced from its usage.
const message = (body: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  id: "msg_01",
  type: "message",
  role: "assistant",
  model: CLAUDE_MODEL,
  content: [{ type: "text", text: JSON.stringify(body) }],
  stop_reason: "end_turn",
  stop_details: null,
  usage: { input_tokens: 5000, output_tokens: 600 },
  ...over,
});
const answers = (yes: string[]) => Object.fromEntries(IDS.map((id) => [id, yes.includes(id)]));

function anthropic(response: unknown) {
  const calls: unknown[] = [];
  const fn: JevTransport = async (request) => {
    calls.push(request);
    return { response, latencyMs: 1200, mode: "live" };
  };
  return { fn, calls };
}

const lane = () =>
  seedRewardLane(t.db, {
    ...buildRewardConfigPayload(rubric),
    scoring: { promptVersion: "reward-eval/3", promptTemplateHash: def.templateHash },
  });

const deps = (
  claude: JevTransport | null,
  extra: Partial<EvaluationDeps> = {},
): EvaluationDeps => ({
  model: "test:anthropic",
  call: async () => {
    throw new Error("the prompt path must not run for a reward-eval/3 quality dispatch");
  },
  ...(claude && { claude: { registry: CLAUDE_REGISTRY, transport: claude } }),
  horizonMs: 5 * MIN,
  clock: later(2 * MIN),
  ...extra,
});

const dispatchesOf = (contributionId: string) =>
  t.db.select().from(rewardDispatches).where(eq(rewardDispatches.contributionId, contributionId));
const decisionsOf = (contributionId: string) =>
  t.db
    .select()
    .from(rewardDecisions)
    .where(eq(rewardDecisions.contributionId, contributionId))
    .orderBy(asc(rewardDecisions.revision));

describe("an epoch pinned to reward-eval/3", () => {
  it("scores a quality dispatch with one Claude call, committed before it is sent", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const tr = anthropic(message(answers(["adds_own", "explains"])));

    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(tr.fn),
    );

    expect(result.status).toBe("completed");
    expect(tr.calls).toHaveLength(1);
    const [d] = await dispatchesOf(intake.contributionId);
    expect(tr.calls[0]).toEqual(d?.input);
    expect(d?.inputHash).toBe(sha256Hex(canonicalJson(d?.input)));
    expect(d).toMatchObject({
      state: "completed",
      purpose: "quality",
      model: "anthropic:claude-haiku-5-5",
      promptVersion: "reward-eval/3",
      promptHash: def.templateHash,
      latencyMs: 1200,
      costMicroUsd: 800,
    });
    expect(d?.output).toMatchObject({
      score: 85,
      flags: [],
      jev: { questionSet: "v4-2026-10-07", model: CLAUDE_MODEL, messageId: "msg_01" },
    });
    expect((await decisionsOf(intake.contributionId))[0]).toMatchObject({
      rawQuality: 85,
      creditedQuality: 85,
    });
  });

  it("still applies the credit rules in code: a gate credits nothing", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(anthropic(message(answers(["generic", "adds_own"]))).fn),
    );
    const [decision] = await decisionsOf(intake.contributionId);
    expect(decision).toMatchObject({ rawQuality: 0, creditedQuality: 0, pointUnits: 0n });
    expect(decision?.explanation).toMatch(/^Scored 0 because it reads as a greeting/);
  });

  it("parks a refusal for reconciliation, keeping the paid response at the Haiku price", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const refused = message(
      {},
      {
        content: [],
        stop_reason: "refusal",
        stop_details: { type: "refusal", category: "general_harms", explanation: null },
      },
    );
    const tr = anthropic(refused);
    const run = () =>
      runEvaluation(
        t.db,
        { communityId: l.community.id, target: { contributionId: intake.contributionId } },
        deps(tr.fn),
      );

    expect(await run()).toEqual({ status: "pending_reconciliation" });
    expect(await run()).toEqual({ status: "pending_reconciliation" });
    expect(tr.calls).toHaveLength(1);
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d).toMatchObject({
      state: "pending_reconciliation",
      output: { jev: { response: refused } },
      latencyMs: 1200,
      costMicroUsd: 800,
    });
    expect(d?.error).toContain("claude: refused (general_harms)");
    expect(await decisionsOf(intake.contributionId)).toHaveLength(0);
    await expect(
      recordNotSentProven(t.db, {
        communityId: l.community.id,
        dispatchId: d?.id as string,
        reason: "operator: provider dashboard shows no request",
      }),
    ).rejects.toThrow(/a response is on record/);
  });

  it("parks a call whose response body outlives the deadline, and never calls again", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    let requests = 0;
    // Headers at once, the answer only after the deadline. As fetch does, an abort ends the body.
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      requests += 1;
      const signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const late = setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(message(answers([])))));
            controller.close();
          }, 1_000);
          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(late);
              controller.error(signal.reason);
            },
            { once: true },
          );
        },
      });
      return new Response(body, { headers: { "content-type": "application/json" } });
    };
    const transport = claudeTransport({ apiKey: "sk-ant-test", fetch, timeoutMs: 40 });
    const run = () =>
      runEvaluation(
        t.db,
        { communityId: l.community.id, target: { contributionId: intake.contributionId } },
        deps(transport),
      );

    expect(await run()).toEqual({ status: "pending_reconciliation" });
    expect(await run()).toEqual({ status: "pending_reconciliation" });
    expect(requests).toBe(1);
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d).toMatchObject({ state: "pending_reconciliation", output: null });
    expect(d?.error).toContain("claude: no complete response within 40 ms");
    expect(await decisionsOf(intake.contributionId)).toHaveLength(0);
  });

  it("parks a response with an answer missing, never retrying it", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const partial = answers([]);
    delete partial.explains;
    const tr = anthropic(message(partial));
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(tr.fn),
    );
    expect(result).toEqual({ status: "pending_reconciliation" });
    expect(tr.calls).toHaveLength(1);
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d?.error).toContain("claude: no yes/no answer for explains");
    expect(d).toMatchObject({ costMicroUsd: 800, output: { jev: { response: message(partial) } } });
  });

  it("is not ready, with no dispatch, where only the Jev engine is enabled", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const jev = anthropic({});
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(null, { jev: { registry: new Map(), transport: jev.fn } }),
    );
    expect(result).toEqual({ status: "not_ready", reason: "prompt_unavailable" });
    expect(await dispatchesOf(intake.contributionId)).toHaveLength(0);
    expect(jev.calls).toHaveLength(0);
  });

  it("calls Claude, not the Jev engine, when both are enabled", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const claude = anthropic(message(answers([])));
    const jev = anthropic({});
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(claude.fn, { jev: { registry: new Map(), transport: jev.fn } }),
    );
    expect(result.status).toBe("completed");
    expect(claude.calls).toHaveLength(1);
    expect(jev.calls).toHaveLength(0);
  });

  it("judges a nomination's quality and effort with the Anthropic prompt, not Claude's questions", async () => {
    const { nominate } = await import("./slots.js");
    const l = await lane();
    const intake = await l.admitOne();
    const n = await nominate(
      t.db,
      {
        communityId: l.community.id,
        memberId: l.member.id,
        contributionId: intake.contributionId,
        idempotencyKey: "n1",
      },
      { clock: later(90_000) },
    );
    if (n.status !== "nominated") throw new Error(n.status);
    const tr = anthropic(message(answers([])));
    const prompts: string[] = [];
    const effort = (met: boolean) => ({ met, note: "own test" });
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { nominationId: n.nomination.id } },
      deps(tr.fn, {
        call: async (prompt) => {
          prompts.push(prompt.system);
          return {
            output: {
              score: 85,
              rubricHits: [{ key: "context_fit", met: true, note: "Reacts." }],
              flags: [],
              aiSlop: { patterns: [], templateRhythm: false },
              reasoning: "Specific to the post, in the member's own words.",
              effort: {
                originalSubstance: effort(true),
                inspectableWork: effort(true),
                communityContribution: effort(true),
                missingEssentialEvidence: null,
                explanation: "You ran the flow and posted the result, which others can check.",
              },
            },
            latencyMs: 5,
            costMicroUsd: 100,
          };
        },
      }),
    );
    expect(result.status).toBe("completed");
    expect(tr.calls).toHaveLength(0);
    expect(prompts[0]).toContain("Prompt reward-eval/2");
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d).toMatchObject({
      purpose: "quality_effort",
      model: "test:anthropic",
      promptVersion: "reward-eval/2",
    });
  });

  it("hands Claude the rubric and the contribution the audit page shows", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const tr = anthropic(message(answers([])));
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(tr.fn),
    );
    const user = (tr.calls[0] as { messages: { content: string }[] }).messages[0]?.content;
    expect(user).toContain(`"guidelines": "${rubric.guidelines}"`);
    expect(user).toMatch(
      /"kind": "post",\n\s+"url": "https:\/\/x.com\/a\/status\/\d+",\n\s+"text": "work \d+"/,
    );
  });
});
