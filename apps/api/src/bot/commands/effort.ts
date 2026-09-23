import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { sendEvaluation, sendRetrieval } from "../../jobs/reward-jobs.js";
import { artifactKeyFor } from "../../rewards/intake.js";
import { type NominateResult, nominate } from "../../rewards/slots.js";
import { admittedIntake, hasRewardLane, submitEffort } from "../../rewards/submission.js";
import { parsePostUrl } from "../../x/oembed.js";
import { reply } from "../reply.js";
import { parseSubmitArgs } from "./args.js";
import { ADMIT_REFUSAL, communityAndMember, preflight } from "./submit.js";

const USAGE =
  "Usage: /effort <link to your post or reply>, or /effort <text of your work>. Nominates it for this epoch's effort slot (3× if the work qualifies).";

const REFUSAL: Record<Exclude<NominateResult["status"], "nominated">, string> = {
  not_admitted: "That work has not been submitted in this community.",
  not_yours: "That work was submitted by another member.",
  epoch_closed: "That work's epoch has closed.",
  already_effort: "Effort was already judged for that work.",
  quality_pending: "That work is still being scored; nominate it once its score is in.",
  slot_used: "You have used your effort slot for this epoch.",
  candidates_exhausted: "You have used all three nominations for your effort slot this epoch.",
  slot_in_use: "Your effort slot is held by another nomination this epoch.",
  already_nominated: "That work is already nominated.",
};

// Explicit nomination (O2). Already admitted work is nominated as it is; new work goes through
// the /submit preflight and admission first. Plain /submit never touches the slot.
export async function effort(ctx: CommandContext<Context>) {
  const args = parseSubmitArgs(ctx.match);
  if (!args) return reply(ctx, USAGE);
  if (!ctx.from || !ctx.msg) return;
  const found = await communityAndMember(ctx);
  if (typeof found === "string") return reply(ctx, found);
  const { community, member } = found;
  const nominationKey = `tg:${ctx.chat.id}:${ctx.msg.message_id}:effort`;

  if (!(await hasRewardLane(db, community.id))) {
    return reply(ctx, "Effort rewards are not open in this community yet.");
  }
  let key: string;
  if (args.kind === "text") {
    key = artifactKeyFor({ text: args.text });
  } else {
    const parsed = parsePostUrl(args.url);
    if (!parsed) return reply(ctx, USAGE);
    key = artifactKeyFor({ statusId: parsed.id });
  }

  let result: NominateResult;
  const existing = await admittedIntake(db, community.id, key);
  if (existing) {
    result = await nominate(db, {
      communityId: community.id,
      memberId: member.id,
      contributionId: existing.contributionId,
      idempotencyKey: nominationKey,
    });
  } else {
    const input = await preflight(ctx, args, community, member);
    if (typeof input === "string") return reply(ctx, input);
    const submitted = await submitEffort(db, { admit: input, nominationKey });
    if (!submitted.nominate) {
      const status = submitted.admit.status;
      return reply(ctx, status === "admitted" ? USAGE : ADMIT_REFUSAL[status]);
    }
    result = submitted.nominate;
  }

  if (result.status !== "nominated") return reply(ctx, REFUSAL[result.status]);
  const { nomination } = result;
  if (!result.created) return reply(ctx, REFUSAL.already_nominated);
  if (nomination.state === "pending_evidence") {
    if (result.nextRetrievalRound) {
      await sendRetrieval({
        communityId: community.id,
        nominationId: nomination.id,
        round: result.nextRetrievalRound,
      });
    }
    return reply(
      ctx,
      `Nominated, but essential evidence is missing: ${nomination.pendingReason}. Capture is retried for a few minutes; the slot stays reserved and nothing is judged until the evidence can be seen.`,
    );
  }
  await sendEvaluation({ communityId: community.id, target: { nominationId: nomination.id } });
  return reply(
    ctx,
    nomination.kind === "upgrade"
      ? "Nominated for an effort upgrade. Quality stays as scored; evaluating effort…"
      : "Nominated for your effort slot. Evaluating quality and effort…",
  );
}
