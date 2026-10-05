import {
  communities,
  type Db,
  members,
  raidSubscriptions,
  rewardConfigs,
  rewardIntakes,
} from "@hyphae/db";
import { and, eq, sql } from "drizzle-orm";
import { type CommandContext, type Context, InlineKeyboard } from "grammy";
import { passesBefore, rulesTestFor } from "../../payout/rules-test.js";
import { latestEpoch, RewardConfigPayload } from "../../rewards/config.js";
import { isMemberStatus } from "../membership.js";
import { sendLinkMessage } from "./link.js";
import { mintDecimals } from "./mint-decimals.js";
import {
  SETUP_LINK_PREFIX,
  SETUP_PREFIX,
  type SetupState,
  setupContent,
  setupPayload,
} from "./setup-content.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const parseSetupPayload = (payload: string): string | undefined => {
  const id = payload.startsWith(SETUP_PREFIX) ? payload.slice(SETUP_PREFIX.length) : "";
  return UUID.test(id) ? id : undefined;
};

const wholeTokens = (units: bigint, decimals: number) => {
  const whole = units / 10n ** BigInt(decimals);
  return whole.toLocaleString("en-US");
};

async function loadState(
  db: Db,
  ctx: Context,
  community: typeof communities.$inferSelect,
  userId: number,
): Promise<SetupState> {
  const chat = await ctx.api.getChatMember(
    Number(community.telegramChatId),
    userId,
    // grammY types a polyfill signal; installed node-fetch also accepts the native Node signal.
    AbortSignal.timeout(4_000) as unknown as Parameters<Context["api"]["getChatMember"]>[2],
  );
  const member = await db.query.members.findFirst({
    where: and(eq(members.communityId, community.id), eq(members.telegramUserId, BigInt(userId))),
  });

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
  const test = pinned.success ? rulesTestFor(pinned.data.rubric) : undefined;

  let rules: SetupState["rules"] = test ? "todo" : "unavailable";
  if (test && epoch && member) {
    const passed = await passesBefore(db, {
      memberIds: [member.id],
      testId: test.id,
      before: epoch.closesAt,
    });
    if (passed.has(member.id)) rules = "passed";
  }

  const [subscription] = await db
    .select({ enabled: raidSubscriptions.enabled })
    .from(raidSubscriptions)
    .where(
      and(
        eq(raidSubscriptions.communityId, community.id),
        eq(raidSubscriptions.telegramUserId, BigInt(userId)),
      ),
    );
  const [intakes] =
    member && epoch
      ? await db
          .select({ n: sql<number>`count(*)::int` })
          .from(rewardIntakes)
          .where(and(eq(rewardIntakes.epochId, epoch.id), eq(rewardIntakes.memberId, member.id)))
      : [];

  let holdMin: string | null = null;
  if (pinned.success) {
    const units = BigInt(pinned.data.rubric.minHoldUnits);
    const decimals = units === 0n ? 0 : await mintDecimals(community.mint);
    if (decimals !== undefined) holdMin = wholeTokens(units, decimals);
  }

  return {
    communityId: community.id,
    name: community.name,
    mint: community.mint,
    botUsername: ctx.me.username,
    joined: isMemberStatus(chat),
    wallet: !member ? "none" : member.linkMethod === "signature" ? "verified" : "unverified",
    rules,
    alerts: subscription?.enabled === true,
    replied: (intakes?.n ?? 0) > 0,
    closesAt: epoch?.closesAt ?? null,
    holdMin,
  };
}

function keyboard(buttons: ReturnType<typeof setupContent>["buttons"]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const b of buttons) {
    if (b.url) kb.url(b.label, b.url);
    else if (b.callback) kb.text(b.label, b.callback);
    kb.row();
  }
  return kb;
}

const privateUser = (ctx: Context): number | undefined =>
  ctx.chat?.type === "private" && ctx.from ? ctx.from.id : undefined;

const UNAVAILABLE = "Setup could not be loaded right now. Try again in a minute.";

// In the community group: one button into the private chat, where the checklist lives.
export async function setupInGroup(db: Db, ctx: CommandContext<Context>) {
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return ctx.reply("This chat is not a registered Hyphae community.");
  return ctx.reply(
    `Set up for ${community.name} takes a few minutes. It happens in a private chat with me.`,
    {
      reply_parameters: { message_id: ctx.msg.message_id },
      reply_markup: new InlineKeyboard().url(
        "Start setup",
        `https://t.me/${ctx.me.username}?start=${setupPayload(community.id)}`,
      ),
    },
  );
}

async function showSetup(db: Db, ctx: Context, communityId: string, edit: boolean) {
  const userId = privateUser(ctx);
  if (userId === undefined) return;
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
  });
  if (!community) {
    await ctx.reply("That community is not registered with Hyphae.");
    return;
  }
  let content: ReturnType<typeof setupContent>;
  try {
    content = setupContent(await loadState(db, ctx, community, userId));
  } catch {
    await ctx.reply(UNAVAILABLE);
    return;
  }
  const options = { reply_markup: keyboard(content.buttons) };
  if (!edit) {
    await ctx.reply(content.text, options);
    return;
  }
  try {
    await ctx.editMessageText(content.text, options);
  } catch {
    // Telegram refuses an edit that changes nothing; the checklist is already current.
  }
}

// The private chat opened by the Start setup button.
export async function setupStart(db: Db, ctx: CommandContext<Context>): Promise<boolean> {
  const communityId = parseSetupPayload(ctx.match);
  if (!communityId) return false;
  if (privateUser(ctx) === undefined) return true;
  await showSetup(db, ctx, communityId, false);
  return true;
}

export async function setupRefresh(db: Db, ctx: Context) {
  const id = (ctx.callbackQuery?.data ?? "").slice(SETUP_PREFIX.length);
  if (privateUser(ctx) === undefined || !UUID.test(id)) {
    await ctx.answerCallbackQuery({ text: "Open setup from your own private chat with this bot." });
    return;
  }
  await ctx.answerCallbackQuery();
  await showSetup(db, ctx, id, true);
}

export async function setupLink(db: Db, ctx: Context) {
  const id = (ctx.callbackQuery?.data ?? "").slice(SETUP_LINK_PREFIX.length);
  if (privateUser(ctx) === undefined || !UUID.test(id)) {
    await ctx.answerCallbackQuery({ text: "Open setup from your own private chat with this bot." });
    return;
  }
  await ctx.answerCallbackQuery();
  const community = await db.query.communities.findFirst({ where: eq(communities.id, id) });
  if (!community) {
    await ctx.reply("That community is not registered with Hyphae.");
    return;
  }
  await sendLinkMessage(ctx, community);
}
