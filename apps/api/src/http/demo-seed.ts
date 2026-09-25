// A community with one closed and one open reward epoch covering every audit state, built only
// through the reward functions production uses (the model is a fake). Tests use it, and the local
// end-to-end run seeds a disposable database with it:
//   DATABASE_URL=<local postgres> node --import tsx src/http/demo-seed.ts
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { RewardPurpose, Rubric } from "@hyphae/core";
import {
  communities,
  createDb,
  type Db,
  linkSessions,
  members,
  memberWalletLinks,
  walletProofRequests,
} from "@hyphae/db";
import { closeEpoch } from "../rewards/close.js";
import {
  bootstrapRewardEpochs,
  buildRewardConfigPayload,
  type Clock,
  latestEpoch,
} from "../rewards/config.js";
import { appendCorrection } from "../rewards/decisions.js";
import { beginDispatch, completeDispatch, runEvaluation } from "../rewards/evaluation.js";
import { admitContribution } from "../rewards/intake.js";
import { nominate } from "../rewards/slots.js";

const MIN = 60_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

const rubric: Rubric = {
  version: "1.2.0",
  community: "DEMO",
  guidelines: "Add something real to the conversation. No price promises. Be specific.",
  criteria: [{ key: "context_fit", label: "Specific", weight: 1, description: "Reacts." }],
  timing: { fullUntil: 360, zeroAt: 2880 },
  stakeWeight: "none",
  minHoldUnits: "100000000000",
  proposalAcceptThreshold: 70,
};

const quality = (score: number, flags: string[] = []) => ({
  score,
  rubricHits: [{ key: "context_fit", met: score >= 60, note: "reacts to the post" }],
  flags,
  aiSlop: { patterns: [], templateRhythm: false },
  reasoning: flags.length ? "Talks about something else than the post." : "Specific to the post.",
});
const effort = {
  originalSubstance: { met: true, note: "own walkthrough of the claim flow" },
  inspectableWork: { met: true, note: "steps and screenshots linked" },
  communityContribution: { met: true, note: "answers a question holders keep asking" },
  missingEssentialEvidence: null,
  explanation: "You tested the flow yourself and published the steps and the result.",
};
export const fakeModel =
  (score: number, flags: string[] = []) =>
  async (_prompt: unknown, purpose: RewardPurpose) => ({
    output: purpose === "effort" ? { effort } : quality(score, flags),
    latencyMs: 4200,
    costMicroUsd: 12000,
  });
const failingModel = async () => {
  throw new Error("provider timeout");
};

export interface AuditDemo {
  communityId: string;
  mint: string;
  members: { signed: string; pasted: string };
  signedWallet: string;
  pastedWallet: string;
  contributions: {
    upgraded: string;
    offTopic: string;
    pendingAtClose: string;
    reconciling: string;
    late: string;
    openCounted: string;
    openPending: string;
  };
}

// Epoch 1 opens 8 days before `now` and has closed; epoch 2 is open at `now`.
// A signed wallet's proof trail, as verified linking writes it.
export async function seedSignedLink(
  db: Db,
  o: {
    communityId: string;
    memberId: string;
    telegramUserId: bigint;
    wallet: string;
    tokenDigest: string;
    linkedAt: Date;
  },
) {
  const [session] = await db
    .insert(linkSessions)
    .values({
      communityId: o.communityId,
      telegramUserId: o.telegramUserId,
      tokenDigest: o.tokenDigest,
      expiresAt: new Date(o.linkedAt.getTime() + 15 * MIN),
      usedAt: o.linkedAt,
    })
    .returning();
  if (!session) throw new Error("seed: link session");
  const requestId = randomUUID();
  await db.insert(walletProofRequests).values({
    requestId,
    communityId: o.communityId,
    linkSessionId: session.id,
    telegramUserId: o.telegramUserId.toString(),
    walletAddress: o.wallet,
    nonceHash: "0".repeat(64),
    origin: "https://hyphae.test",
    chain: "solana:devnet",
    issuedAt: o.linkedAt,
    expiresAt: new Date(o.linkedAt.getTime() + 5 * MIN),
    status: "consumed",
    consumedAt: o.linkedAt,
  });
  await db.insert(memberWalletLinks).values({
    communityId: o.communityId,
    memberId: o.memberId,
    wallet: o.wallet,
    method: "signature",
    proofRequestId: requestId,
    validFrom: o.linkedAt,
  });
}

export async function seedAuditDemo(db: Db, now: Date): Promise<AuditDemo> {
  const t0 = new Date(Math.floor((now.getTime() - 8 * DAY) / 1000) * 1000);
  const at =
    (ms: number): Clock =>
    async () =>
      new Date(t0.getTime() + ms);
  const suffix = randomUUID().slice(0, 8);
  const mint = `DemoMint${suffix}`;

  const [community] = await db
    .insert(communities)
    .values({
      mint,
      name: "Hyphae Demo",
      telegramChatId: -BigInt(Date.now()) - BigInt(Math.floor(Math.random() * 1e6)),
      adminTelegramUserId: 1n,
      rubricVersion: rubric.version,
      rubric,
    })
    .returning();
  if (!community) throw new Error("demo: community");
  const communityId = community.id;

  const signedWallet = `DemoSigned${suffix}Wallet1111111111111111`;
  const pastedWallet = `DemoPasted${suffix}Wallet2222222222222222`;
  const [signed, pasted] = await db
    .insert(members)
    .values([
      {
        communityId,
        telegramUserId: 987654321987n,
        telegramUsername: "tg_secret_user",
        wallet: signedWallet,
        linkMethod: "signature",
      },
      {
        communityId,
        telegramUserId: 987654321988n,
        telegramUsername: "tg_other_user",
        wallet: pastedWallet,
        linkMethod: "paste",
      },
    ])
    .returning();
  if (!signed || !pasted) throw new Error("demo: members");

  const linkedAt = new Date(t0.getTime() - 60 * MIN);
  await seedSignedLink(db, {
    communityId,
    memberId: signed.id,
    telegramUserId: signed.telegramUserId,
    wallet: signedWallet,
    tokenDigest: `demo-${suffix}`,
    linkedAt,
  });
  await db.insert(memberWalletLinks).values({
    communityId,
    memberId: pasted.id,
    wallet: pastedWallet,
    method: "paste",
    validFrom: linkedAt,
  });

  await bootstrapRewardEpochs(
    db,
    {
      communityId,
      payload: buildRewardConfigPayload(rubric),
      opensAt: t0,
      proposedBy: "script:demo-seed",
    },
    { clock: at(-30 * MIN) },
  );

  let seq = 0;
  const admit = async (memberId: string, whenMs: number, kind: "post" | "text" = "post") => {
    seq += 1;
    const url = kind === "post" ? `https://x.com/demo/status/${suffix}${seq}` : null;
    const r = await admitContribution(
      db,
      {
        communityId,
        memberId,
        contribution: {
          kind,
          url,
          text: `Demo contribution ${seq}: a specific reply to the raid post.`,
          oembed: null,
          telegramMessageId: seq,
        },
        artifactKey: `demo:${suffix}:${seq}`,
        idempotencyKey: `demo:${suffix}:${seq}`,
        capture: {
          source: kind === "post" ? "x_oembed" : "telegram_text",
          capturedAt: new Date(t0.getTime() + whenMs).toISOString(),
          limitations: [],
        },
      },
      { clock: at(whenMs) },
    );
    if (r.status !== "admitted") throw new Error(`demo: admit ${r.status}`);
    return r.intake.contributionId;
  };
  const evaluate = async (contributionId: string, whenMs: number, call = fakeModel(85)) => {
    const r = await runEvaluation(
      db,
      { communityId, target: { contributionId } },
      { model: "demo:fake-model", call, horizonMs: 5 * MIN, clock: at(whenMs) },
    );
    if (r.status !== "completed" && r.status !== "pending_reconciliation") {
      throw new Error(`demo: evaluate ${r.status}`);
    }
  };

  // Epoch 1: ordinary 85 upgraded to eligible effort (255), an off-topic 84 credited 0, one never
  // scored, one whose model call is unresolved at close, one scored only after the close.
  const upgraded = await admit(signed.id, 2 * MIN);
  await evaluate(upgraded, 3 * MIN);
  const nominated = await nominate(
    db,
    {
      communityId,
      memberId: signed.id,
      contributionId: upgraded,
      idempotencyKey: `demo:n:${suffix}`,
    },
    { clock: at(10 * MIN) },
  );
  if (nominated.status !== "nominated") throw new Error(`demo: nominate ${nominated.status}`);
  const upgrade = await runEvaluation(
    db,
    { communityId, target: { nominationId: nominated.nomination.id } },
    { model: "demo:fake-model", call: fakeModel(85), horizonMs: 5 * MIN, clock: at(11 * MIN) },
  );
  if (upgrade.status !== "completed") throw new Error(`demo: upgrade ${upgrade.status}`);

  const offTopic = await admit(signed.id, 20 * MIN, "text");
  await evaluate(offTopic, 21 * MIN, fakeModel(84, ["off_topic"]));

  const pendingAtClose = await admit(pasted.id, 30 * MIN);

  const reconciling = await admit(pasted.id, 40 * MIN);
  await evaluate(reconciling, 41 * MIN, failingModel);

  const late = await admit(pasted.id, WEEK - 10 * MIN);
  const begun = await beginDispatch(
    db,
    { communityId, target: { contributionId: late }, model: "demo:fake-model" },
    { clock: at(WEEK - 5 * MIN) },
  );
  if (begun.status !== "begun") throw new Error(`demo: begin ${begun.status}`);
  const completedLate = await completeDispatch(
    db,
    {
      communityId,
      dispatchId: begun.dispatch.id,
      fence: begun.dispatch.fence,
      output: quality(72),
      latencyMs: 4200,
      costMicroUsd: 12000,
    },
    { clock: at(WEEK + 30_000) },
  );
  if (completedLate.status !== "completed") throw new Error("demo: late completion");

  const epoch1 = await latestEpoch(db, communityId);
  if (!epoch1) throw new Error("demo: epoch 1");
  const closed = await closeEpoch(
    db,
    { communityId, epochId: epoch1.id },
    { clock: at(WEEK + MIN) },
  );
  if (closed.status !== "closed") throw new Error("demo: close");

  // After the close: an explanatory correction that cannot change epoch 1.
  const corrected = await appendCorrection(
    db,
    {
      communityId,
      contributionId: offTopic,
      expectedRevision: 1,
      changes: { flags: [] },
      reason: "On review the reply is about the raid's theme; recorded after the close.",
      evidenceRefs: ["https://x.com/demo/status/raid"],
      actor: "admin:cisco",
      idempotencyKey: `demo:c:${suffix}`,
    },
    { clock: at(WEEK + 2 * 60 * MIN) },
  );
  if (corrected.status !== "appended") throw new Error(`demo: correction ${corrected.status}`);

  // Epoch 2, open at `now`: one scored, one waiting.
  const openCounted = await admit(signed.id, WEEK + 3 * 60 * MIN);
  await evaluate(openCounted, WEEK + 3 * 60 * MIN + MIN, fakeModel(70));
  const openPending = await admit(pasted.id, WEEK + 4 * 60 * MIN);

  return {
    communityId,
    mint,
    members: { signed: signed.id, pasted: pasted.id },
    signedWallet,
    pastedWallet,
    contributions: {
      upgraded,
      offTopic,
      pendingAtClose,
      reconciling,
      late,
      openCounted,
      openPending,
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const demo = await seedAuditDemo(createDb(url), new Date());
  console.log(JSON.stringify(demo, null, 2));
  process.exit(0);
}
