import {
  canonicalJson,
  effortEligible,
  type Prompt,
  type RewardPurpose,
  rawQuality,
  renderRewardPrompt,
  rewardOutputSchema,
  rewardPointUnits,
  type ScoringInput,
  sha256Hex,
} from "@hyphae/core";
import {
  contributions,
  type Db,
  epochs,
  rewardConfigs,
  rewardDecisions,
  rewardDispatches,
  rewardIntakes,
  rewardNominations,
  rewardRetrievals,
  rewardSlots,
  tasks,
} from "@hyphae/db";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { jevCostMicroUsd } from "../scoring/jev.js";
import {
  type JevRegistry,
  type JevScorerDef,
  type JevTransport,
  pinHash,
  routeFor,
} from "../scoring/scorers.js";
import { RewardConfigPayload, type RewardDeps, withCommunityLock } from "./config.js";
import type { Capture, RewardIntake } from "./intake.js";
import type { Nomination } from "./slots.js";

export type Dispatch = typeof rewardDispatches.$inferSelect;
export type Decision = typeof rewardDecisions.$inferSelect;
export type EvaluationTarget = { nominationId: string } | { contributionId: string };
type Tx = Db;

const NO_MULTIPLIER = 10_000;

async function loadIntake(tx: Tx, communityId: string, contributionId: string) {
  const [intake] = await tx
    .select()
    .from(rewardIntakes)
    .where(
      and(
        eq(rewardIntakes.communityId, communityId),
        eq(rewardIntakes.contributionId, contributionId),
      ),
    );
  return intake;
}

async function loadContext(tx: Tx, intake: RewardIntake) {
  const [epoch] = await tx.select().from(epochs).where(eq(epochs.id, intake.epochId));
  const [config] = await tx
    .select({ payload: rewardConfigs.payload })
    .from(rewardConfigs)
    .where(eq(rewardConfigs.id, intake.configId));
  if (!epoch || !config) throw new Error(`reward: context for intake ${intake.id} missing`);
  const [task] = intake.taskId
    ? await tx.select().from(tasks).where(eq(tasks.id, intake.taskId))
    : [];
  return { epoch, payload: RewardConfigPayload.parse(config.payload), task };
}

// Timing measures the original submission (O3); a re-entry's own intake time is not it.
async function originalAcceptance(tx: Tx, intake: RewardIntake): Promise<Date> {
  if (!intake.reentryOf) return intake.acceptedAt;
  const [origin] = await tx
    .select({ acceptedAt: rewardIntakes.acceptedAt })
    .from(rewardIntakes)
    .where(eq(rewardIntakes.id, intake.reentryOf));
  if (!origin) throw new Error(`reward: intake ${intake.reentryOf} missing`);
  return origin.acceptedAt;
}

async function latestDecision(tx: Tx, contributionId: string): Promise<Decision | undefined> {
  const [row] = await tx
    .select()
    .from(rewardDecisions)
    .where(eq(rewardDecisions.contributionId, contributionId))
    .orderBy(desc(rewardDecisions.revision))
    .limit(1);
  return row;
}

async function liveDispatch(tx: Tx, target: { slotId: string } | { qualityOf: string }) {
  const [row] = await tx
    .select()
    .from(rewardDispatches)
    .where(
      and(
        "slotId" in target
          ? eq(rewardDispatches.slotId, target.slotId)
          : and(
              eq(rewardDispatches.contributionId, target.qualityOf),
              eq(rewardDispatches.purpose, "quality"),
            ),
        ne(rewardDispatches.state, "not_sent_proven"),
      ),
    );
  return row;
}

// What the one provider call carries: a rendered Anthropic prompt, or the typed questions a Jev
// scorer answers about the same contribution.
export type ScorerRequest =
  | { kind: "prompt"; version: string; prompt: Prompt }
  | { kind: "jev"; def: JevScorerDef; input: ScoringInput };

export interface JevDeps {
  registry: JevRegistry;
  transport: JevTransport;
}

// The engines enabled here for Jev scorers: TypeSafe's Jev model, and Claude answering the same
// question sets. Each is called through its own transport.
export interface JevEngines {
  jev?: JevDeps;
  claude?: JevDeps;
}

const engineFor = (deps: JevEngines, version: string): JevDeps | undefined =>
  [deps.jev, deps.claude].find((e) => e?.registry.has(version));

export type BeginResult =
  | { status: "begun"; dispatch: Dispatch; request: ScorerRequest; purpose: RewardPurpose }
  | { status: "exists"; dispatch: Dispatch; ageMs: number }
  | { status: "not_ready"; reason: string };

// Step 1 of a fenced dispatch (O2): commit the dispatch row, and with it the slot's new fence,
// before any network call. From that commit on, the call may have happened.
export async function beginDispatch(
  db: Db,
  input: { communityId: string; target: EvaluationTarget; model: string },
  deps: RewardDeps & JevEngines = {},
): Promise<BeginResult> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    let nomination: Nomination | undefined;
    let contributionId: string;
    if ("nominationId" in input.target) {
      [nomination] = await tx
        .select()
        .from(rewardNominations)
        .where(
          and(
            eq(rewardNominations.id, input.target.nominationId),
            eq(rewardNominations.communityId, input.communityId),
          ),
        );
      if (!nomination) throw new Error(`reward: nomination ${input.target.nominationId} missing`);
      contributionId = nomination.contributionId;
      if (nomination.state === "pending_evidence" || nomination.state === "withdrawn") {
        return { status: "not_ready", reason: nomination.state };
      }
      const existing = await liveDispatch(tx, { slotId: nomination.slotId });
      if (existing) {
        return {
          status: "exists",
          dispatch: existing,
          ageMs: now.getTime() - existing.dispatchedAt.getTime(),
        };
      }
      if (nomination.state !== "ready") return { status: "not_ready", reason: nomination.state };
    } else {
      contributionId = input.target.contributionId;
      const existing = await liveDispatch(tx, { qualityOf: contributionId });
      if (existing) {
        return {
          status: "exists",
          dispatch: existing,
          ageMs: now.getTime() - existing.dispatchedAt.getTime(),
        };
      }
      if (await latestDecision(tx, contributionId))
        return { status: "not_ready", reason: "decided" };
      const [nominated] = await tx
        .select({ id: rewardNominations.id })
        .from(rewardNominations)
        .where(
          and(
            eq(rewardNominations.contributionId, contributionId),
            eq(rewardNominations.kind, "new_work"),
            ne(rewardNominations.state, "withdrawn"),
          ),
        );
      if (nominated) return { status: "not_ready", reason: "nominated" };
    }

    const intake = await loadIntake(tx, input.communityId, contributionId);
    if (!intake) return { status: "not_ready", reason: "not_admitted" };
    const { epoch, payload, task } = await loadContext(tx, intake);
    if (now.getTime() >= epoch.closesAt.getTime()) {
      return { status: "not_ready", reason: "epoch_closed" };
    }
    const { promptVersion } = payload.scoring;
    const scorers = engineFor(deps, promptVersion)?.registry;
    if (pinHash(promptVersion, scorers) !== payload.scoring.promptTemplateHash) {
      if (nomination) {
        await tx
          .update(rewardNominations)
          .set({ pendingReason: "prompt_unavailable", updatedAt: now })
          .where(eq(rewardNominations.id, nomination.id));
      }
      return { status: "not_ready", reason: "prompt_unavailable" };
    }

    const purpose: RewardPurpose = !nomination
      ? "quality"
      : nomination.kind === "upgrade"
        ? "effort"
        : "quality_effort";
    const [contribution] = await tx
      .select()
      .from(contributions)
      .where(eq(contributions.id, contributionId));
    if (!contribution) throw new Error(`reward: contribution ${contributionId} missing`);
    let limitations = (intake.capture as Capture).limitations;
    if (nomination) {
      const [round] = await tx
        .select({ limitations: rewardRetrievals.limitations })
        .from(rewardRetrievals)
        .where(
          and(
            eq(rewardRetrievals.contributionId, contributionId),
            eq(rewardRetrievals.epochId, intake.epochId),
          ),
        )
        .orderBy(desc(rewardRetrievals.round))
        .limit(1);
      if (round) limitations = round.limitations;
    }
    const prior = purpose === "effort" ? await latestDecision(tx, contributionId) : undefined;
    if (purpose === "effort" && !prior) throw new Error("reward: upgrade without a decision");
    const route = routeFor(promptVersion, purpose, scorers);
    if (!route) throw new Error(`reward: no scorer for ${promptVersion} although its pin matched`);
    const scored: ScoringInput = {
      rubric: payload.rubric,
      task: task?.targetUrl
        ? {
            targetUrl: task.targetUrl,
            targetText: task.targetText ?? "",
            targetAuthor: task.targetAuthor ?? "",
            brief: task.brief,
          }
        : undefined,
      contribution: {
        kind: contribution.kind,
        url: contribution.url ?? undefined,
        text: contribution.text,
        authorHandle: (contribution.oembed as { handle?: string } | null)?.handle,
      },
    };
    // A Jev version answers quality only; an effort judgment runs on the prompt version the Jev
    // version names, and its dispatch records that version, not the epoch's.
    const request: ScorerRequest =
      route.kind === "jev"
        ? { kind: "jev", def: route.def, input: scored }
        : {
            kind: "prompt",
            version: route.version,
            prompt: renderRewardPrompt(route.version, purpose, {
              ...scored,
              effortCriteria: payload.effort.criteria,
              limitations,
              priorQuality: prior
                ? {
                    raw: prior.rawQuality,
                    credited: prior.creditedQuality,
                    reasoning: prior.explanation,
                  }
                : undefined,
            }),
          };
    const sent = (() => {
      if (request.kind === "prompt") {
        return {
          model: input.model,
          promptVersion: request.version,
          promptHash: sha256Hex(request.prompt.system),
          inputHash: sha256Hex(canonicalJson(request.prompt)),
          input: request.prompt as unknown,
        };
      }
      const { body, hash } = request.def.request(request.input);
      return {
        model: request.def.model,
        promptVersion,
        promptHash: request.def.templateHash,
        inputHash: hash,
        input: body,
      };
    })();

    let fence: number;
    if (nomination) {
      const [slot] = await tx
        .select()
        .from(rewardSlots)
        .where(eq(rewardSlots.id, nomination.slotId));
      if (!slot) throw new Error(`reward: slot ${nomination.slotId} missing`);
      fence = slot.generation + 1;
      await tx.update(rewardSlots).set({ generation: fence }).where(eq(rewardSlots.id, slot.id));
      await tx
        .update(rewardNominations)
        .set({ state: "evaluating", pendingReason: null, updatedAt: now })
        .where(eq(rewardNominations.id, nomination.id));
    } else {
      const earlier = await tx
        .select({ id: rewardDispatches.id })
        .from(rewardDispatches)
        .where(
          and(
            eq(rewardDispatches.contributionId, contributionId),
            eq(rewardDispatches.purpose, "quality"),
          ),
        );
      fence = earlier.length + 1;
    }
    const [dispatch] = await tx
      .insert(rewardDispatches)
      .values({
        communityId: input.communityId,
        contributionId,
        nominationId: nomination?.id ?? null,
        slotId: nomination?.slotId ?? null,
        purpose,
        fence,
        idempotencyKey: `${purpose}:${nomination?.id ?? contributionId}:${fence}`,
        state: "dispatched",
        ...sent,
        dispatchedAt: now,
      })
      .returning();
    if (!dispatch) throw new Error("reward: dispatch insert returned nothing");
    return { status: "begun", dispatch, request, purpose };
  });
}

export interface CompleteInput {
  communityId: string;
  dispatchId: string;
  fence: number;
  output: unknown;
  latencyMs: number;
  costMicroUsd: number;
}

export type CompleteResult =
  | { status: "completed"; decision: Decision; created: boolean }
  | { status: "pending_evidence"; reason: string }
  | { status: "stale" };

// Step 3 (O2/O3): one transaction stores the output, appends the decision, and consumes the
// slot. It accepts the original outcome even after the dispatch moved to reconciliation, but
// never for a dispatch an operator has recorded as not sent.
export async function completeDispatch(
  db: Db,
  input: CompleteInput,
  deps: RewardDeps = {},
): Promise<CompleteResult> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const [dispatch] = await tx
      .select()
      .from(rewardDispatches)
      .where(
        and(
          eq(rewardDispatches.id, input.dispatchId),
          eq(rewardDispatches.communityId, input.communityId),
        ),
      );
    if (!dispatch) throw new Error(`reward: dispatch ${input.dispatchId} missing`);
    const nomination = dispatch.nominationId
      ? (
          await tx
            .select()
            .from(rewardNominations)
            .where(eq(rewardNominations.id, dispatch.nominationId))
        )[0]
      : undefined;

    if (dispatch.state === "completed") {
      const [decision] = await tx
        .select()
        .from(rewardDecisions)
        .where(eq(rewardDecisions.dispatchId, dispatch.id));
      if (decision) return { status: "completed", decision, created: false };
      return { status: "pending_evidence", reason: nomination?.pendingReason ?? "unknown" };
    }
    // Withdrawal is refused while a dispatch may be in flight and a proven non-dispatch changes
    // the state, so the dispatch's own state and fence are the complete staleness check.
    if (
      dispatch.fence !== input.fence ||
      (dispatch.state !== "dispatched" && dispatch.state !== "pending_reconciliation")
    ) {
      return { status: "stale" };
    }

    const parsed = rewardOutputSchema(dispatch.purpose).parse(input.output);
    const effort = "effort" in parsed ? parsed.effort : null;
    const quality = "score" in parsed ? parsed : null;
    const stored = {
      state: "completed" as const,
      output: input.output,
      outputHash: sha256Hex(canonicalJson(input.output)),
      latencyMs: input.latencyMs,
      costMicroUsd: input.costMicroUsd,
      resolvedAt: now,
    };

    if (effort?.missingEssentialEvidence) {
      await tx.update(rewardDispatches).set(stored).where(eq(rewardDispatches.id, dispatch.id));
      if (nomination) {
        await tx
          .update(rewardNominations)
          .set({
            state: "pending_evidence",
            pendingReason: effort.missingEssentialEvidence,
            updatedAt: now,
          })
          .where(
            and(
              eq(rewardNominations.id, nomination.id),
              ne(rewardNominations.state, "expired_at_close"),
            ),
          );
      }
      return { status: "pending_evidence", reason: effort.missingEssentialEvidence };
    }

    const intake = await loadIntake(tx, input.communityId, dispatch.contributionId);
    if (!intake) throw new Error(`reward: intake for ${dispatch.contributionId} missing`);
    const { epoch, payload, task } = await loadContext(tx, intake);
    const eligible = effort !== null && effortEligible(effort);
    const multiplierBps = eligible ? payload.effort.multiplierBps : NO_MULTIPLIER;
    const prior = await latestDecision(tx, dispatch.contributionId);

    let derived: {
      rawQuality: number;
      creditedQuality: number;
      flags: unknown;
      timingBps: number;
      pointUnits: bigint;
    };
    if (quality) {
      const points = rewardPointUnits({
        credit: {
          rawQuality: rawQuality(BigInt(quality.score)),
          flags: quality.flags,
          aiSlop: {
            patternCount: BigInt(quality.aiSlop.patterns.length),
            templateRhythm: quality.aiSlop.templateRhythm,
          },
        },
        timing: {
          ...(task ? { taskOpensAtMs: BigInt(task.opensAt.getTime()) } : {}),
          submittedAtMs: BigInt((await originalAcceptance(tx, intake)).getTime()),
          fullCreditUntilMs: BigInt(payload.timing.fullCreditUntilMs),
          zeroCreditAtMs: BigInt(payload.timing.zeroCreditAtMs),
        },
        multiplierBps: BigInt(multiplierBps),
      });
      derived = {
        rawQuality: quality.score,
        creditedQuality: Number(points.creditedQuality),
        flags: quality.flags,
        timingBps: Number(points.timingBps),
        pointUnits: points.pointUnits,
      };
    } else {
      // An upgrade judges effort only; quality, flags and timing come from the predecessor.
      if (!prior) throw new Error("reward: upgrade without a decision");
      derived = {
        rawQuality: prior.rawQuality,
        creditedQuality: prior.creditedQuality,
        flags: prior.flags,
        timingBps: prior.timingBps,
        pointUnits: BigInt(prior.creditedQuality) * BigInt(prior.timingBps) * BigInt(multiplierBps),
      };
    }
    const explanation = [quality?.reasoning, effort ? `Effort: ${effort.explanation}` : null]
      .filter(Boolean)
      .join("\n\n");

    const affectsAllocation = now.getTime() < epoch.closesAt.getTime();
    const [decision] = await tx
      .insert(rewardDecisions)
      .values({
        communityId: input.communityId,
        contributionId: dispatch.contributionId,
        epochId: intake.epochId,
        configId: intake.configId,
        revision: dispatch.purpose === "effort" && prior ? prior.revision + 1 : 1,
        predecessorId: dispatch.purpose === "effort" && prior ? prior.id : null,
        dispatchId: dispatch.id,
        nominationId: nomination?.id ?? null,
        ...derived,
        effort: effort === null ? "not_nominated" : eligible ? "eligible" : "ineligible",
        effortCriteria: effort
          ? {
              originalSubstance: effort.originalSubstance,
              inspectableWork: effort.inspectableWork,
              communityContribution: effort.communityContribution,
            }
          : null,
        multiplierBps,
        explanation,
        acceptedAt: now,
        affectsAllocation,
      })
      .returning();
    if (!decision) throw new Error("reward: decision insert returned nothing");
    await tx.update(rewardDispatches).set(stored).where(eq(rewardDispatches.id, dispatch.id));
    if (nomination) {
      await tx
        .update(rewardNominations)
        .set({
          // O3: a late answer still used the origin epoch's one evaluation of this artifact.
          state: !affectsAllocation
            ? "completed_after_cutoff"
            : eligible
              ? "completed_eligible"
              : "completed_ineligible",
          updatedAt: now,
        })
        .where(eq(rewardNominations.id, nomination.id));
      await tx
        .update(rewardSlots)
        .set({ state: "consumed", consumedAt: now, consumedDecisionId: decision.id })
        .where(eq(rewardSlots.id, nomination.slotId));
    }
    return { status: "completed", decision, created: true };
  });
}

// Any provider error, timeout, refusal or unusable output: the call may have been billed, so the
// work waits for its original outcome or an operator's proof that nothing was sent.
export async function markReconciliation(
  db: Db,
  input: {
    communityId: string;
    dispatchId: string;
    error: string;
    output?: unknown;
    latencyMs?: number;
    costMicroUsd?: number | null;
  },
  deps: RewardDeps = {},
): Promise<void> {
  await withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const [dispatch] = await tx
      .update(rewardDispatches)
      .set({
        state: "pending_reconciliation",
        error: input.error,
        output: input.output ?? null,
        latencyMs: input.latencyMs ?? null,
        costMicroUsd: input.costMicroUsd ?? null,
      })
      .where(
        and(
          eq(rewardDispatches.id, input.dispatchId),
          eq(rewardDispatches.communityId, input.communityId),
          eq(rewardDispatches.state, "dispatched"),
        ),
      )
      .returning();
    // A response that arrives after another run already parked the dispatch is still evidence of
    // what was paid for: attach it once, keeping the state and the first error.
    if (!dispatch && input.output !== undefined) {
      await tx
        .update(rewardDispatches)
        .set({
          output: input.output,
          latencyMs: input.latencyMs ?? null,
          costMicroUsd: input.costMicroUsd ?? null,
          error: sql`coalesce(${rewardDispatches.error}, '') || ${`; then: ${input.error}`}`,
        })
        .where(
          and(
            eq(rewardDispatches.id, input.dispatchId),
            eq(rewardDispatches.communityId, input.communityId),
            eq(rewardDispatches.state, "pending_reconciliation"),
            isNull(rewardDispatches.output),
          ),
        );
      return;
    }
    if (dispatch?.nominationId) {
      await tx
        .update(rewardNominations)
        .set({ state: "pending_reconciliation", updatedAt: now })
        .where(
          and(
            eq(rewardNominations.id, dispatch.nominationId),
            eq(rewardNominations.state, "evaluating"),
          ),
        );
    }
  });
}

// Operator record that a request provably never reached the provider. The only path that frees a
// dispatch budget; it also moves the slot fence so the old dispatch can never complete.
export async function recordNotSentProven(
  db: Db,
  input: { communityId: string; dispatchId: string; reason: string },
  deps: RewardDeps = {},
): Promise<Dispatch> {
  return withCommunityLock(db, input.communityId, deps, async (tx, _community, now) => {
    const [dispatch] = await tx
      .update(rewardDispatches)
      .set({ state: "not_sent_proven", reconcileReason: input.reason, resolvedAt: now })
      .where(
        and(
          eq(rewardDispatches.id, input.dispatchId),
          eq(rewardDispatches.communityId, input.communityId),
          eq(rewardDispatches.state, "pending_reconciliation"),
          // A provider response on the row proves the request was sent, so it can never be freed.
          isNull(rewardDispatches.output),
        ),
      )
      .returning();
    if (!dispatch) {
      throw new Error(
        `reward: dispatch ${input.dispatchId} is not pending reconciliation, or a response is on record (it was sent)`,
      );
    }
    if (dispatch.nominationId && dispatch.slotId) {
      await tx
        .update(rewardNominations)
        .set({ state: "ready", pendingReason: null, updatedAt: now })
        .where(
          and(
            eq(rewardNominations.id, dispatch.nominationId),
            eq(rewardNominations.state, "pending_reconciliation"),
          ),
        );
      const [slot] = await tx.select().from(rewardSlots).where(eq(rewardSlots.id, dispatch.slotId));
      if (!slot) throw new Error(`reward: slot ${dispatch.slotId} missing`);
      await tx
        .update(rewardSlots)
        .set({ generation: slot.generation + 1 })
        .where(eq(rewardSlots.id, slot.id));
    }
    return dispatch;
  });
}

export interface ProviderResult {
  output: unknown;
  latencyMs: number;
  costMicroUsd: number;
}

// The Jev engines are set only where enabled; an epoch pinned to a scorer they lack is not ready.
export interface EvaluationDeps extends RewardDeps, JevEngines {
  model: string;
  call: (prompt: Prompt, purpose: RewardPurpose) => Promise<ProviderResult>;
  // How long a dispatch without an outcome may be another worker's live call.
  horizonMs: number;
}

export type RunResult =
  | CompleteResult
  | { status: "not_ready"; reason: string }
  | { status: "already_completed" | "pending_reconciliation" }
  | { status: "in_flight"; recheckAfterMs: number };

const COMPLETE_ATTEMPTS = 3;

// The reward evaluation job. It calls the provider at most once per begun dispatch; a re-run
// that finds a dispatch never calls again.
export async function runEvaluation(
  db: Db,
  input: { communityId: string; target: EvaluationTarget },
  deps: EvaluationDeps,
): Promise<RunResult> {
  const begun = await beginDispatch(
    db,
    { communityId: input.communityId, target: input.target, model: deps.model },
    deps,
  );
  if (begun.status === "not_ready") return begun;
  if (begun.status === "exists") {
    const { dispatch, ageMs } = begun;
    if (dispatch.state === "completed") return { status: "already_completed" };
    if (dispatch.state === "pending_reconciliation") return { status: "pending_reconciliation" };
    if (ageMs < deps.horizonMs)
      return { status: "in_flight", recheckAfterMs: deps.horizonMs - ageMs };
    await markReconciliation(
      db,
      {
        communityId: input.communityId,
        dispatchId: dispatch.id,
        error: `no outcome recorded within ${deps.horizonMs} ms`,
      },
      deps,
    );
    return { status: "pending_reconciliation" };
  }

  const { dispatch, request, purpose } = begun;
  let result: ProviderResult;
  // What a Jev call returned, kept so a response that fails later checks is still on the record.
  let received: { response: unknown; latencyMs: number; costMicroUsd: number | null } | undefined;
  const withResponse = (output: object): object =>
    received
      ? { ...output, jev: { ...(output as { jev?: object }).jev, response: received.response } }
      : output;
  try {
    if (request.kind === "prompt") {
      result = await deps.call(request.prompt, purpose);
    } else {
      const engine = engineFor(deps, request.def.version);
      if (!engine) throw new Error(`reward: the scorer ${request.def.version} is not enabled`);
      const costOf = request.def.costOf ?? jevCostMicroUsd;
      const score = await request.def.run(request.input, async (body) => {
        const answer = await engine.transport(body);
        received = {
          response: answer.response,
          latencyMs: answer.latencyMs,
          costMicroUsd: costOf(answer.response),
        };
        return answer;
      });
      result = {
        output: { ...score.output, jev: score.evidence },
        latencyMs: score.latencyMs,
        costMicroUsd: score.costMicroUsd,
      };
      // The row committed before the call is the record of what was asked; the call must match it.
      if (score.requestHash !== dispatch.inputHash) {
        throw new Error("jev: request hash differs from the dispatch's committed input hash");
      }
    }
  } catch (err) {
    await markReconciliation(
      db,
      {
        communityId: input.communityId,
        dispatchId: dispatch.id,
        error: String(err),
        ...(received && {
          output: withResponse({}),
          latencyMs: received.latencyMs,
          costMicroUsd: received.costMicroUsd,
        }),
      },
      deps,
    );
    return { status: "pending_reconciliation" };
  }
  if (!rewardOutputSchema(purpose).safeParse(result.output).success) {
    await markReconciliation(
      db,
      {
        communityId: input.communityId,
        dispatchId: dispatch.id,
        error: "output failed the reward schema",
        output: withResponse(result.output as object),
        latencyMs: result.latencyMs,
        costMicroUsd: result.costMicroUsd,
      },
      deps,
    );
    return { status: "pending_reconciliation" };
  }
  // Database writes are free to retry; the model call is not.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await completeDispatch(
        db,
        {
          communityId: input.communityId,
          dispatchId: dispatch.id,
          fence: dispatch.fence,
          ...result,
        },
        deps,
      );
    } catch (err) {
      if (attempt >= COMPLETE_ATTEMPTS) throw err;
    }
  }
}
