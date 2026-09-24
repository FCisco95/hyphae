import { communities, type Db, members, rewardConfigs } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { type CommandContext, Composer, type Context, InlineKeyboard } from "grammy";
import {
  grade,
  type RulesTest,
  recordPass,
  rulesTestById,
  rulesTestFor,
} from "../../payout/rules-test.js";
import { latestEpoch, RewardConfigPayload } from "../../rewards/config.js";
import { reply } from "../reply.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATA = /^rt:([a-z0-9-]{1,13}):([0-9a-f-]{36}):([0-9]{0,8})$/;
const LETTERS = ["a", "b", "c", "d"] as const;
const STALE = "That test message is out of date. Send /rules in your community chat.";

export const rulesStartPayload = (communityId: string): string => `rules_${communityId}`;
export const parseRulesStartPayload = (payload: string): string | undefined => {
  const id = payload.startsWith("rules_") ? payload.slice(6) : "";
  return UUID.test(id) ? id : undefined;
};

// Button data carries the answers so far, so no attempt state is stored. It comes back from the
// client and is untrusted: every tap is re-validated, and the pass goes to the tapping user.
export const rulesData = (testId: string, communityId: string, answers: readonly number[]) =>
  `rt:${testId}:${communityId}:${answers.join("")}`;
export function parseRulesData(
  data: string,
): { testId: string; communityId: string; answers: number[] } | undefined {
  const m = DATA.exec(data);
  if (!m?.[1] || !m[2] || m[3] === undefined || !UUID.test(m[2])) return undefined;
  return { testId: m[1], communityId: m[2], answers: [...m[3]].map(Number) };
}

const answersFit = (test: RulesTest, answers: readonly number[]) =>
  answers.length <= test.questions.length &&
  answers.every((a, i) => a < (test.questions[i]?.options.length ?? 0));

function question(test: RulesTest, communityId: string, answers: readonly number[]) {
  const i = answers.length;
  const q = test.questions[i];
  if (!q) throw new Error(`rules test: no question ${i + 1}`);
  const keyboard = new InlineKeyboard();
  q.options.forEach((_, k) => {
    keyboard.text(LETTERS[k] ?? String(k), rulesData(test.id, communityId, [...answers, k]));
  });
  const text = [
    `Question ${i + 1} of ${test.questions.length}`,
    "",
    q.text,
    "",
    ...q.options.map((o, k) => `${LETTERS[k]}) ${o}`),
  ].join("\n");
  return { text, keyboard };
}

function result(test: RulesTest, communityId: string, answers: readonly number[]) {
  const n = test.questions.length;
  const { correct, passed } = grade(test, answers);
  const rules = test.covers.map((c) => `${c.community} ${c.version}`).join(", ");
  const head = passed
    ? `Passed: ${n}/${n}. Your pass counts for epochs under the ${rules} rules.`
    : `${correct}/${n}. You need ${n}/${n} to pass.`;
  const review = test.questions.map(
    (q, i) =>
      `${i + 1}. ${answers[i] === q.answer ? "✓" : "✗"} ${q.text}\nAnswer: ${q.options[q.answer]} ${q.why}`,
  );
  const keyboard = new InlineKeyboard().text("Take it again", rulesData(test.id, communityId, []));
  return { passed, text: [head, "", ...review].join("\n\n"), keyboard };
}

const memberOf = (db: Db, communityId: string, telegramUserId: number) =>
  db.query.members.findFirst({
    where: and(
      eq(members.communityId, communityId),
      eq(members.telegramUserId, BigInt(telegramUserId)),
    ),
  });

// The test for the rules pinned by the community's latest epoch: the one members are earning in
// now, or the next one once it is materialized.
async function currentTest(db: Db, communityId: string): Promise<RulesTest | undefined> {
  const epoch = await latestEpoch(db, communityId);
  if (!epoch?.rewardConfigId) return undefined;
  const [config] = await db
    .select({ payload: rewardConfigs.payload })
    .from(rewardConfigs)
    .where(eq(rewardConfigs.id, epoch.rewardConfigId));
  const payload = RewardConfigPayload.safeParse(config?.payload);
  return payload.success ? rulesTestFor(payload.data.rubric) : undefined;
}

// The private chat opened by the /rules deep link.
export async function rulesStart(db: Db, ctx: CommandContext<Context>): Promise<boolean> {
  const communityId = parseRulesStartPayload(ctx.match);
  if (!ctx.from || !communityId) return false;
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
  });
  if (!community) {
    await ctx.reply("That community is not registered with Hyphae.");
    return true;
  }
  if (!(await memberOf(db, community.id, ctx.from.id))) {
    await ctx.reply(`Link a wallet first: send /link in ${community.name}.`);
    return true;
  }
  const test = await currentTest(db, community.id);
  if (!test) {
    await ctx.reply(`There is no rules test for ${community.name}'s current rules yet.`);
    return true;
  }
  const n = test.questions.length;
  const first = question(test, community.id, []);
  await ctx.reply(
    `Rules test for ${community.name}: ${n} questions, and all ${n} must be right to pass. A pass is one of the conditions for being paid.\n\n${first.text}`,
    { reply_markup: first.keyboard },
  );
  return true;
}

export function rulesTest(db: Db): Composer<Context> {
  const composer = new Composer<Context>();

  composer.command("rules", async (ctx) => {
    if (ctx.chat.type === "private") return ctx.reply("Send /rules in your community chat.");
    const community = await db.query.communities.findFirst({
      where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
    });
    if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
    return reply(
      ctx,
      `Take the rules test privately: https://t.me/${ctx.me.username}?start=${rulesStartPayload(community.id)}`,
    );
  });

  composer.callbackQuery(/^rt:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.chat?.type !== "private") return;
    const data = parseRulesData(ctx.callbackQuery.data);
    const test = data && rulesTestById(data.testId);
    const community =
      data &&
      test &&
      answersFit(test, data.answers) &&
      (await db.query.communities.findFirst({ where: eq(communities.id, data.communityId) }));
    if (!data || !test || !community) return ctx.editMessageText(STALE);

    if (data.answers.length < test.questions.length) {
      const next = question(test, community.id, data.answers);
      return ctx.editMessageText(next.text, { reply_markup: next.keyboard });
    }
    const member = await memberOf(db, community.id, ctx.from.id);
    if (!member)
      return ctx.editMessageText(`Link a wallet first: send /link in ${community.name}.`);
    const done = result(test, community.id, data.answers);
    if (done.passed) {
      await recordPass(db, { communityId: community.id, memberId: member.id, testId: test.id });
    }
    return ctx.editMessageText(done.text, { reply_markup: done.keyboard });
  });

  return composer;
}
