import { communities, type Db, rewardConfigs, tasks } from "@hyphae/db";
import { and, desc, eq, gt } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { rulesTestFor } from "../../payout/rules-test.js";
import { MAX_OPEN_RAIDS } from "../../raid-alerts/alerts.js";
import { latestEpoch, RewardConfigPayload } from "../../rewards/config.js";
import {
  briefContent,
  helpContent,
  type OnboardingCommunity,
  PARTICIPANT_KEYS,
  welcomeContent,
} from "./onboarding-content.js";

const UNAVAILABLE =
  "Guidance is unavailable right now. Try /help again later or ask the community owner.";

async function context(db: Db, ctx: CommandContext<Context>, webOrigin: string) {
  if (!ctx.from || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return;
  const latest = await latestEpoch(db, community.id);
  const now = new Date();
  const epoch =
    latest?.status === "open" && latest.opensAt <= now && latest.closesAt > now
      ? latest
      : undefined;
  const [config] = epoch?.rewardConfigId
    ? await db
        .select({ payload: rewardConfigs.payload })
        .from(rewardConfigs)
        .where(eq(rewardConfigs.id, epoch.rewardConfigId))
    : [];
  const pinned = RewardConfigPayload.safeParse(config?.payload);
  const display: OnboardingCommunity = {
    name: community.name,
    mint: community.mint,
    webOrigin,
    paused: community.rewardIntakePausedAt !== null,
    epoch: epoch
      ? {
          index: epoch.index,
          closesAt: epoch.closesAt,
          rubricVersion: pinned.success ? pinned.data.rubric.version : null,
          rulesQuestions: pinned.success
            ? (rulesTestFor(pinned.data.rubric)?.questions.length ?? null)
            : null,
        }
      : null,
  };
  return { id: community.id, display };
}

const options = (ctx: CommandContext<Context>, keyboard: boolean) => ({
  link_preview_options: { is_disabled: true },
  reply_parameters: { message_id: ctx.msg.message_id },
  ...(keyboard
    ? {
        reply_markup: {
          keyboard: PARTICIPANT_KEYS.map((row) => row.map((text) => ({ text }))),
          resize_keyboard: true,
          one_time_keyboard: true,
          selective: true,
        },
      }
    : {}),
});

export async function onboardingWelcome(db: Db, ctx: CommandContext<Context>, webOrigin: string) {
  let resolved: Awaited<ReturnType<typeof context>>;
  try {
    resolved = await context(db, ctx, webOrigin);
  } catch {
    return ctx.reply(UNAVAILABLE, options(ctx, false));
  }
  return ctx.reply(welcomeContent(resolved?.display), options(ctx, !!resolved));
}

export async function onboardingHelp(db: Db, ctx: CommandContext<Context>, webOrigin: string) {
  const arg = ctx.match.trim();
  if (arg !== "" && arg !== "brief")
    return ctx.reply(
      "Use /help for score guidance or /help brief for the current brief.",
      options(ctx, false),
    );
  let text: string;
  let registered = false;
  try {
    const resolved = await context(db, ctx, webOrigin);
    registered = !!resolved;
    if (resolved && arg === "brief") {
      const open = await db.query.tasks.findMany({
        where: and(
          eq(tasks.communityId, resolved.id),
          eq(tasks.status, "open"),
          gt(tasks.closesAt, new Date()),
        ),
        orderBy: [desc(tasks.opensAt)],
        limit: MAX_OPEN_RAIDS,
      });
      text = briefContent(resolved.display, open);
    } else text = helpContent(resolved?.display);
  } catch {
    return ctx.reply(UNAVAILABLE, options(ctx, false));
  }
  return ctx.reply(text, options(ctx, registered));
}
