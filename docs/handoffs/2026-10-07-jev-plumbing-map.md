---
date: 2026-10-07
summary: Session B map of the reward evaluation path for a Jev scorer, and what was built. A Jev version is pinned like a prompt version; the dispatch is committed before the call; Jev answers quality only; amendments can now chain so epoch 2 can move to Jev; nothing changes in production until JEV_SCORING is on and a registry entry exists.
---

# Jev plumbing: how the reward path pins, stores and reconciles a scorer

Written 2026-10-07 by Claude Sonnet 5.5 (Session B). Source: `jev-plumbing` branch, commits `fadf80c`, `772caea`, `8d12d2a`, `b672657`, `039f94d` on top of `18325c6`. Session A owns the questions and their composition (`jev.ts`, `jev-questions.ts`, `docs/evals/**`).

## 1. How the path worked before

| Question | Answer in the code |
|---|---|
| What pins the scorer? | The epoch's reward config holds `scoring.promptVersion` and `scoring.promptTemplateHash`. A contribution pins the config of the moment it was admitted (`rewardIntakes.configId`; `admissionConfigId` picks the latest amendment in effect). |
| Where is the call made? | `beginDispatch` (`rewards/evaluation.ts`) renders the prompt for the pinned version and commits a `reward_dispatches` row with `model`, `promptVersion`, `promptHash`, `inputHash`, `input` before any network call. `runEvaluation` then calls `deps.call` once. `completeDispatch` stores `output`, `outputHash`, latency and cost and writes the decision in one transaction. |
| What is cost? | `costMicroUsd` from the provider's usage, stored on the dispatch, shown on the audit page. |
| What if the call fails? | Any error, timeout, refusal or output that fails the reward schema goes to `markReconciliation`: the dispatch becomes `pending_reconciliation`, nothing is called again, and only an operator's proof that nothing was sent (`recordNotSentProven`) frees it. |
| Where do credit rules live? | In code, after the model: `rewardPointUnits` applies the hard-zero flags, the AI caps, the 60 floor and timing to the model's `score`, `flags` and `aiSlop`. The model never sees them. |
| What does the audit page show? | Per revision: `model`, `prompt_version`, `prompt_hash`, `input_hash`, `output_hash`, latency, cost; the epoch's amendments. |

## 2. What a Jev call needs, and what was built

| Need | Decision |
|---|---|
| **Pin** | A Jev scorer is a registered version like `reward-jev/1`. Its template hash is `jevTemplateHash(model, questionSet)`: the model, every question and every weight, never the rubric or the key. The epoch config pins it exactly like a prompt version, so the amendment record, the manifest and the public pages need no new field. |
| **Request committed first** | `beginDispatch` stores the Jev request (`state`, `questions`, `model`) as the dispatch `input` and its SHA-256 as `inputHash`, before the call. After the call the scorer's own request hash must equal it, or the dispatch goes to reconciliation. |
| **Evidence** | Dispatch `model` is `typesafe:jev-1.13.0`, `promptVersion` the pinned version, `promptHash` the template hash. `output` is the composed reward output plus a `jev` object (question set id, answers, usage, composition, hashes) so the typed answers are inside the committed `outputHash`. |
| **Client** | `scoring/jev-client.ts`: pinned SDK `@typesafe-ai/sdk@0.6.0`, 30 s timeout (under the 90 s reward timeout the reconciliation horizon is built on), `maxRetries: 0` (a retry after a possibly executed request could bill twice), logging off (the SDK's debug level logs member text). |
| **Cost** | From usage: input tokens × USD 0.042 per 1M, output free (A's `runJev`). Stored in micro-USD like today. |
| **Failure** | A missing or malformed answer throws inside the scorer (A's `JevResponseSchema` and `composeJev`), so the dispatch goes to reconciliation with the error. A composed output that fails the reward schema is stored as evidence and reconciled. Same operator path as today. |
| **Credit rules** | Unchanged. The composed `score`, `flags` and `aiSlop` go through `rewardPointUnits`. A test shows `off_topic` crediting 0 at raw 88. |
| **Effort** | Jev answers quality only. A nomination (`quality_effort`, `effort`) runs on the prompt version the Jev scorer names (`effortVersion`, `reward-eval/2`), with the Anthropic model; its dispatch records that version and model, not the epoch's. Mixed in one epoch, but each dispatch says which scorer made it. |
| **Off switch** | `JEV_SCORING=off` is the default. Off, an epoch pinned to a Jev version is `prompt_unavailable` (nothing is called, and the contribution waits unscored until Jev is on). On needs `TYPESAFE_API_KEY` and a registered scorer or the worker refuses to start. |
| **Empty registry** | `scoring/jev-registry.ts` is empty on purpose. No Jev version can be pinned until Session A's entry exists. |

## 3. Why epoch 2 needed more than a flag

The database allowed one amendment per epoch, and epoch 2 already has one (`reward-eval/2`, effective 18:00Z). Cisco ruled Jev starts in epoch 2, so amendments now form a chain:

- Migration `0017_reward_amendment_chain` swaps the unique index `reward_config_amendments_epoch (epoch_id)` for `reward_config_amendments_epoch_from (epoch_id, from_config_id)`: a config can be left once. No row changes.
- `amendEpochPrompt` starts from the config in force, requires the previous amendment to be in effect already, and refuses the epoch's own config. It allows one way back from Jev to the first amendment's prompt, the emergency exit.
- `admissionConfigId` pins the latest amendment in effect. The audit manifest schema checks the chain (first from the epoch's config, each next from the previous result); a manifest with one amendment commits the same bytes as before.
- Not allowed, and why it matters: after Jev is in effect, there is no way back to the epoch's original `reward-eval/1`, and the way back to `reward-eval/2` can be used once. Contributions admitted under Jev stay pinned to Jev; if Jev is off they wait (`prompt_unavailable`), so a rollback means turning scoring back on for them, not re-scoring.

## 4. What Session A hands over

1. A `JevScorerDef` for the v4 set in `scoring/jev-registry.ts`. Exact shape, using A's own exports:

```ts
import { jevRequest, requestHash, runJev, JEV_MODEL, type JevQuestionSet } from "./jev.js";
import { type JevScorerDef, jevTemplateHash } from "./scorers.js";

function jevScorer(version: string, set: JevQuestionSet): JevScorerDef {
  return {
    version,
    effortVersion: "reward-eval/2",
    templateHash: jevTemplateHash(JEV_MODEL, set),
    model: `typesafe:${JEV_MODEL}`,
    request: (input) => {
      const body = jevRequest(input, set);
      return { body, hash: requestHash(body) };
    },
    run: async (input, transport) => {
      const r = await runJev(input, set, transport);
      return {
        output: r.output,
        requestHash: r.requestHash,
        latencyMs: r.latencyMs,
        costMicroUsd: r.costMicroUsd,
        evidence: {
          questionSet: r.questionSet,
          model: r.model,
          rubricVersion: r.rubricVersion,
          configurationHash: r.configurationHash,
          composition: r.composition,
          usage: r.usage,
          answers: r.answers,
        },
      };
    },
  };
}
export const JEV_REGISTRY: JevRegistry = new Map([["reward-jev/1", jevScorer("reward-jev/1", QUESTIONS_V4)]]);
```

2. On merge, keep `@typesafe-ai/sdk` under `dependencies` in `apps/api/package.json` (this branch has it there). The image installs `--prod`, so a `devDependencies` entry would build and then fail to start.
3. The set must be deterministic JSON (plain objects, no functions): its hash is the pin.
4. `run.output.reasoning` becomes the member-visible explanation. Today it reads "Composed from jev-1.13.0 answers … quality 2.00 of 3; context_fit 0.91 …". Decide if members should see that or a plain sentence (A's file).
5. The wording on the public pages says "prompt"; for Jev it is a scorer version. Cisco and A decide the public sentence before the announcement.

## 5. Verified

`pnpm lint` 0, `pnpm typecheck` 0, `pnpm test` 0 (core 119, read-client 26, web 123, API 905 passed, 3 skipped), `drizzle-kit check` fine, `pnpm --filter @hyphae/api test:pg` 74 of 74 (an earlier run failed 5 of the known intermittent member-journey and raid-alert Postgres tests, as in the amendment release record; the next run passed). `page-handoff.test.ts` failed twice in one full run under load and passes alone. Migration 0017 rehearsed through the real `db.mjs` on a disposable `postgres:17` seeded in Hyphae Lab's shape.

Not verified: any live Jev call (no key was used), the Anthropic path against production data, a build of the Docker image.
