// A community whose epoch 1 is closed and ready to pay: three payable members (an effort upgrade
// worth 255 points, an ordinary 85 and a 70) and one with 60 points and only a pasted wallet.
// Built through the reward functions production uses, with a fake model, like the audit demo.
// The publish tests and the devnet run use it; it reproduces the seeded_ready_epoch vector.
import { randomBytes, randomUUID } from "node:crypto";
import type { Rubric } from "@hyphae/core";
import {
  communities,
  type Db,
  holdChecks,
  linkSessions,
  members,
  memberWalletLinks,
  rulesTestPasses,
  walletProofRequests,
} from "@hyphae/db";
import { getAddressDecoder } from "@solana/kit";
import { fakeModel } from "../http/demo-seed.js";
import { closeEpoch } from "../rewards/close.js";
import {
  bootstrapRewardEpochs,
  buildRewardConfigPayload,
  type Clock,
  latestEpoch,
} from "../rewards/config.js";
import { type EvaluationTarget, runEvaluation } from "../rewards/evaluation.js";
import { admitContribution } from "../rewards/intake.js";
import { nominate } from "../rewards/slots.js";
import { rulesTestFor } from "./rules-test.js";

const MIN = 60_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
export const READY_HOLD_THRESHOLD = "100000000000";

// MYCEL 1.2.0, so the real MYCEL rules test applies.
const rubric: Rubric = {
  version: "1.2.0",
  community: "MYCEL",
  guidelines: "Add something real to the conversation. No price promises. Be specific.",
  criteria: [{ key: "context_fit", label: "Specific", weight: 1, description: "Reacts." }],
  timing: { fullUntil: 360, zeroAt: 2880 },
  stakeWeight: "none",
  minHoldUnits: READY_HOLD_THRESHOLD,
  proposalAcceptThreshold: 70,
};

export type ReadyLabel = "effort" | "ordinary" | "floor" | "unsigned";
const PAYABLE = ["effort", "ordinary", "floor"] as const;

export interface ReadySeed {
  communityId: string;
  epochId: string;
  mint: string;
  closesAt: Date;
  members: Record<ReadyLabel, string>;
  wallets: Record<ReadyLabel, string>;
}

export const randomAddress = () => getAddressDecoder().decode(randomBytes(32));

// Epoch 1 opens 8 days before `now` and has closed.
export async function seedReadyEpoch(
  db: Db,
  opts: {
    now: Date;
    mint?: string;
    wallets?: Partial<Record<(typeof PAYABLE)[number], string>>;
    chainAddress?: string | null;
  },
): Promise<ReadySeed> {
  const t0 = new Date(Math.floor((opts.now.getTime() - 8 * DAY) / 1000) * 1000);
  const at =
    (ms: number): Clock =>
    async () =>
      new Date(t0.getTime() + ms);
  const suffix = randomUUID().slice(0, 8);
  const mint = opts.mint ?? randomAddress();

  const [community] = await db
    .insert(communities)
    .values({
      mint,
      name: "Hyphae Ready",
      telegramChatId: -BigInt(Date.now()) - BigInt(Math.floor(Math.random() * 1e6)),
      adminTelegramUserId: 1n,
      rubricVersion: rubric.version,
      rubric,
      chainAddress: opts.chainAddress ?? null,
      firstPaidEpoch: 1,
    })
    .returning();
  if (!community) throw new Error("ready: community");
  const communityId = community.id;

  const wallets: Record<ReadyLabel, string> = {
    effort: opts.wallets?.effort ?? randomAddress(),
    ordinary: opts.wallets?.ordinary ?? randomAddress(),
    floor: opts.wallets?.floor ?? randomAddress(),
    unsigned: randomAddress(),
  };
  const labels: ReadyLabel[] = ["effort", "ordinary", "floor", "unsigned"];
  const memberIds = {} as Record<ReadyLabel, string>;
  const linkedAt = new Date(t0.getTime() - 60 * MIN);
  for (const [i, label] of labels.entries()) {
    const telegramUserId = BigInt(Date.now()) * 10n + BigInt(i);
    const signed = label !== "unsigned";
    const [member] = await db
      .insert(members)
      .values({
        communityId,
        telegramUserId,
        wallet: wallets[label],
        linkMethod: signed ? "signature" : "paste",
      })
      .returning();
    if (!member) throw new Error(`ready: member ${label}`);
    memberIds[label] = member.id;
    if (!signed) {
      await db.insert(memberWalletLinks).values({
        communityId,
        memberId: member.id,
        wallet: wallets[label],
        method: "paste",
        validFrom: linkedAt,
      });
      continue;
    }
    // The proof trail verified linking writes.
    const [session] = await db
      .insert(linkSessions)
      .values({
        communityId,
        telegramUserId,
        tokenDigest: `ready-${suffix}-${label}`,
        expiresAt: new Date(linkedAt.getTime() + 15 * MIN),
        usedAt: linkedAt,
      })
      .returning();
    if (!session) throw new Error("ready: link session");
    const requestId = randomUUID();
    await db.insert(walletProofRequests).values({
      requestId,
      communityId,
      linkSessionId: session.id,
      telegramUserId: telegramUserId.toString(),
      walletAddress: wallets[label],
      nonceHash: "0".repeat(64),
      origin: "https://hyphae.test",
      chain: "solana:devnet",
      issuedAt: linkedAt,
      expiresAt: new Date(linkedAt.getTime() + 5 * MIN),
      status: "consumed",
      consumedAt: linkedAt,
    });
    await db.insert(memberWalletLinks).values({
      communityId,
      memberId: member.id,
      wallet: wallets[label],
      method: "signature",
      proofRequestId: requestId,
      validFrom: linkedAt,
    });
  }

  await bootstrapRewardEpochs(
    db,
    {
      communityId,
      payload: buildRewardConfigPayload(rubric),
      opensAt: t0,
      proposedBy: "script:ready-seed",
    },
    { clock: at(-30 * MIN) },
  );

  let seq = 0;
  const admit = async (label: ReadyLabel, whenMs: number) => {
    seq += 1;
    const r = await admitContribution(
      db,
      {
        communityId,
        memberId: memberIds[label],
        contribution: {
          kind: "post",
          url: `https://x.com/ready/status/${suffix}${seq}`,
          text: `Ready contribution ${seq}: a specific reply to the raid post.`,
          oembed: null,
          telegramMessageId: seq,
        },
        artifactKey: `ready:${suffix}:${seq}`,
        idempotencyKey: `ready:${suffix}:${seq}`,
        capture: {
          source: "x_oembed",
          capturedAt: new Date(t0.getTime() + whenMs).toISOString(),
          limitations: [],
        },
      },
      { clock: at(whenMs) },
    );
    if (r.status !== "admitted") throw new Error(`ready: admit ${r.status}`);
    return r.intake.contributionId;
  };
  const evaluate = async (target: EvaluationTarget, whenMs: number, score: number) => {
    const r = await runEvaluation(
      db,
      { communityId, target },
      { model: "ready:fake-model", call: fakeModel(score), horizonMs: 5 * MIN, clock: at(whenMs) },
    );
    if (r.status !== "completed") throw new Error(`ready: evaluate ${r.status}`);
  };

  const upgraded = await admit("effort", 2 * MIN);
  await evaluate({ contributionId: upgraded }, 3 * MIN, 85);
  const nominated = await nominate(
    db,
    {
      communityId,
      memberId: memberIds.effort,
      contributionId: upgraded,
      idempotencyKey: `ready:n:${suffix}`,
    },
    { clock: at(10 * MIN) },
  );
  if (nominated.status !== "nominated") throw new Error(`ready: nominate ${nominated.status}`);
  await evaluate({ nominationId: nominated.nomination.id }, 11 * MIN, 85);
  await evaluate({ contributionId: await admit("ordinary", 20 * MIN) }, 21 * MIN, 85);
  await evaluate({ contributionId: await admit("floor", 30 * MIN) }, 31 * MIN, 70);
  await evaluate({ contributionId: await admit("unsigned", 40 * MIN) }, 41 * MIN, 60);

  const epoch = await latestEpoch(db, communityId);
  if (!epoch) throw new Error("ready: epoch");
  const closed = await closeEpoch(
    db,
    { communityId, epochId: epoch.id },
    { clock: at(WEEK + MIN) },
  );
  if (closed.status !== "closed") throw new Error("ready: close");

  const test = rulesTestFor(rubric);
  if (!test) throw new Error("ready: no rules test covers the rubric");
  for (const label of PAYABLE) {
    await db.insert(rulesTestPasses).values({
      communityId,
      memberId: memberIds[label],
      testId: test.id,
      passedAt: new Date(epoch.closesAt.getTime() - 60 * MIN),
    });
    await db.insert(holdChecks).values({
      communityId,
      epochId: epoch.id,
      memberId: memberIds[label],
      wallet: wallets[label],
      mint,
      thresholdRaw: READY_HOLD_THRESHOLD,
      checkRound: randomUUID(),
      status: "holder",
      attempts: 1,
      rawAmount: "150000000000",
      decimals: 6,
      provider: "consensus",
      slot: "412345678",
      observedAt: new Date(epoch.closesAt.getTime() + 5 * MIN),
      checkedAt: new Date(epoch.closesAt.getTime() + 5 * MIN),
    });
  }
  return {
    communityId,
    epochId: epoch.id,
    mint,
    closesAt: epoch.closesAt,
    members: memberIds,
    wallets,
  };
}
