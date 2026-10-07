import { canonicalJson, type ScoreOutput, type ScoringInput, sha256Hex } from "@hyphae/core";
import { rewardDecisions, rewardDispatches } from "@hyphae/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type JevScorerDef, type JevTransport, jevTemplateHash } from "../scoring/scorers.js";
import { buildRewardConfigPayload } from "./config.js";
import { type EvaluationDeps, runEvaluation } from "./evaluation.js";
import { createTestDb, later, rubric, seedRewardLane } from "./test-db.js";

const MIN = 60_000;
const SET = { id: "test-set", questions: ["context_fit", "low_effort"] };
const MODEL = "jev-1.13.0";
const HASH = jevTemplateHash(MODEL, SET);

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const composed = (score: number, flags: ScoreOutput["flags"] = []): ScoreOutput => ({
  score,
  rubricHits: [{ key: "context_fit", met: true, note: "Jev P(yes) 0.91" }],
  flags,
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: "Composed from jev-1.13.0 answers (question set test-set): quality 2.00 of 3.",
});

// A stand-in for A's engine: builds a request from the input, then "calls" the transport once.
function fakeDef(
  answer: (input: ScoringInput) => Promise<ScoreOutput> | ScoreOutput,
  over: Partial<JevScorerDef> = {},
) {
  const runs: ScoringInput[] = [];
  const requestOf = (input: ScoringInput) => {
    const body = { model: MODEL, state: { contribution: input.contribution.text }, questions: SET };
    return { body, hash: sha256Hex(canonicalJson(body)) };
  };
  const def: JevScorerDef = {
    version: "reward-jev/1",
    effortVersion: "reward-eval/2",
    templateHash: HASH,
    model: `typesafe:${MODEL}`,
    request: requestOf,
    run: async (input, transport) => {
      runs.push(input);
      const request = requestOf(input);
      const { response, latencyMs } = await transport(request.body);
      const output = await answer(input);
      return {
        output,
        evidence: {
          questionSet: SET.id,
          answers: response,
          usage: { input_tokens: 2000, output_tokens: 0 },
        },
        requestHash: request.hash,
        latencyMs,
        costMicroUsd: 84,
      };
    },
    ...over,
  };
  return { def, runs };
}

function transport() {
  const calls: unknown[] = [];
  const fn: JevTransport = async (request) => {
    calls.push(request);
    return {
      response: { answers: { quality: { type: "score", score: 2 } } },
      latencyMs: 40,
      mode: "live",
    };
  };
  return { fn, calls };
}

const lane = () =>
  seedRewardLane(t.db, {
    ...buildRewardConfigPayload(rubric),
    scoring: { promptVersion: "reward-jev/1", promptTemplateHash: HASH },
  });

const deps = (
  def: JevScorerDef | null,
  tr: JevTransport,
  extra: Partial<EvaluationDeps> = {},
): EvaluationDeps => ({
  model: "test:anthropic",
  call: async () => {
    throw new Error("the Anthropic path must not run for a Jev quality dispatch");
  },
  ...(def && { jev: { registry: new Map([[def.version, def]]), transport: tr } }),
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

describe("a Jev-pinned epoch", () => {
  it("scores a quality dispatch with one Jev call and stores the typed evidence", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def, runs } = fakeDef(() => composed(72));
    const tr = transport();

    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(def, tr.fn),
    );

    expect(result.status).toBe("completed");
    expect(runs).toHaveLength(1);
    expect(tr.calls).toHaveLength(1);
    const [d] = await dispatchesOf(intake.contributionId);
    const request = def.request(runs[0] as ScoringInput);
    expect(d).toMatchObject({
      state: "completed",
      purpose: "quality",
      model: "typesafe:jev-1.13.0",
      promptVersion: "reward-jev/1",
      promptHash: HASH,
      inputHash: request.hash,
      input: request.body,
      latencyMs: 40,
      costMicroUsd: 84,
    });
    expect(d?.output).toMatchObject({
      ...composed(72),
      jev: { questionSet: "test-set", usage: { input_tokens: 2000, output_tokens: 0 } },
    });
    expect(d?.outputHash).toBe(sha256Hex(canonicalJson(d?.output)));
    expect((await decisionsOf(intake.contributionId))[0]).toMatchObject({
      rawQuality: 72,
      creditedQuality: 72,
    });
  });

  it("hands the scorer the rubric, the task and the contribution the audit page shows", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def, runs } = fakeDef(() => composed(70));
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(def, transport().fn),
    );
    expect(runs[0]?.rubric.version).toBe(rubric.version);
    expect(runs[0]?.contribution).toMatchObject({
      kind: "post",
      text: expect.stringMatching(/^work /),
    });
  });

  it("still applies the credit rules in code: a hard-zero flag credits nothing", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def } = fakeDef(() => composed(88, ["off_topic"]));
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(def, transport().fn),
    );
    expect((await decisionsOf(intake.contributionId))[0]).toMatchObject({
      rawQuality: 88,
      creditedQuality: 0,
      pointUnits: 0n,
    });
  });

  it("parks a failed call for reconciliation and never calls again", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def, runs } = fakeDef(() => {
      throw new Error("jev: no yes/no answer for context_fit");
    });
    const run = () =>
      runEvaluation(
        t.db,
        { communityId: l.community.id, target: { contributionId: intake.contributionId } },
        deps(def, transport().fn),
      );

    expect(await run()).toEqual({ status: "pending_reconciliation" });
    expect(await run()).toEqual({ status: "pending_reconciliation" });
    expect(runs).toHaveLength(1);
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d).toMatchObject({ state: "pending_reconciliation" });
    expect(d?.error).toContain("no yes/no answer for context_fit");
    expect(await decisionsOf(intake.contributionId)).toHaveLength(0);
  });

  it("parks a malformed response, keeping what was paid for: the response, latency and cost", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def } = fakeDef(() => {
      throw new Error("jev: no yes/no answer for explains");
    });
    const paid = {
      model: MODEL,
      answers: { generic: { type: "noul", noul: 0.1 } },
      usage: { input_tokens: 2000, output_tokens: 0 },
    };
    const tr: JevTransport = async () => ({ response: paid, latencyMs: 40, mode: "live" });
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(def, tr),
    );
    expect(result).toEqual({ status: "pending_reconciliation" });
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d).toMatchObject({
      state: "pending_reconciliation",
      output: { jev: { response: paid } },
      latencyMs: 40,
      costMicroUsd: 84,
    });
    expect(d?.error).toContain("explains");
  });

  it("parks a call that got no response with nothing to keep", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def } = fakeDef(() => composed(72));
    const failing: JevTransport = async () => {
      throw new Error("Request timed out after 30000 ms");
    };
    await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(def, failing),
    );
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d).toMatchObject({
      state: "pending_reconciliation",
      output: null,
      latencyMs: null,
      costMicroUsd: null,
    });
    expect(d?.error).toContain("timed out");
  });

  it("parks a composed output that fails the reward schema, keeping the output as evidence", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def } = fakeDef(() => ({ ...composed(72), score: 172 }));
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(def, transport().fn),
    );
    expect(result).toEqual({ status: "pending_reconciliation" });
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d).toMatchObject({
      state: "pending_reconciliation",
      error: "output failed the reward schema",
    });
    expect(d?.output).toMatchObject({ score: 172 });
    expect(d).toMatchObject({ latencyMs: 40, costMicroUsd: 84 });
  });

  it("parks a call whose request is not the one the dispatch committed", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def } = fakeDef(() => composed(72));
    const drifting: JevScorerDef = {
      ...def,
      run: async (input, tr) => ({ ...(await def.run(input, tr)), requestHash: "f".repeat(64) }),
    };
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(drifting, transport().fn),
    );
    expect(result).toEqual({ status: "pending_reconciliation" });
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d?.error).toContain("request hash");
    expect(d).toMatchObject({
      output: { jev: { response: { answers: { quality: { type: "score", score: 2 } } } } },
      latencyMs: 40,
    });
    expect(await decisionsOf(intake.contributionId)).toHaveLength(0);
  });

  it("is not ready, with no dispatch, when the scorer is not enabled here", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(null, transport().fn),
    );
    expect(result).toEqual({ status: "not_ready", reason: "prompt_unavailable" });
    expect(await dispatchesOf(intake.contributionId)).toHaveLength(0);
  });

  it("is not ready when the registered scorer's pin differs from the epoch's pin", async () => {
    const l = await lane();
    const intake = await l.admitOne();
    const { def } = fakeDef(() => composed(72), { templateHash: "c".repeat(64) });
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { contributionId: intake.contributionId } },
      deps(def, transport().fn),
    );
    expect(result).toEqual({ status: "not_ready", reason: "prompt_unavailable" });
    expect(await dispatchesOf(intake.contributionId)).toHaveLength(0);
  });

  it("judges a nomination's quality and effort with the Anthropic prompt, not Jev", async () => {
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
    const { def, runs } = fakeDef(() => composed(72));
    const prompts: string[] = [];
    const effort = (met: boolean) => ({ met, note: "own test" });
    const result = await runEvaluation(
      t.db,
      { communityId: l.community.id, target: { nominationId: n.nomination.id } },
      deps(def, transport().fn, {
        call: async (prompt) => {
          prompts.push(prompt.system);
          return {
            output: {
              ...composed(85),
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
    expect(runs).toHaveLength(0);
    expect(prompts[0]).toContain("Prompt reward-eval/2");
    const [d] = await dispatchesOf(intake.contributionId);
    expect(d).toMatchObject({
      purpose: "quality_effort",
      model: "test:anthropic",
      promptVersion: "reward-eval/2",
    });
  });
});
