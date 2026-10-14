import { createHash } from "node:crypto";
import { InlineKeyboard } from "grammy";
import { plural, type RaidStats, span } from "../raid-alerts/stats.js";
import { engageLinks } from "../x/intents.js";
import { escapeHtml } from "./html.js";

export type CardState = "open" | "ended" | "cancelled";

// From the live spike: whether Telegram renders <tg-time> inside a photo caption.
export const TG_TIME_IN_CAPTIONS = true;
const CAPTION_LIMIT = 1024;

export const EMPTY_STATS: RaidStats = {
  members: 0,
  replies: 0,
  quotes: 0,
  credited: 0,
  averageCredited: null,
  scoring: 0,
  epochs: [],
};

export interface CardView {
  state: CardState;
  handle: string | null;
  closesAt: Date;
  brief: string;
  fullUntilMinutes: number;
  stats: RaidStats;
  ranMs: number;
  cancelReason: string | null;
  now: Date;
}

const utc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

function endsLine(v: CardView, tgTime: boolean) {
  if (tgTime)
    return `Ends <tg-time unix="${Math.floor(v.closesAt.getTime() / 1000)}" format="r">${utc(v.closesAt)}</tg-time>`;
  // Whole hours, rounded up, so the line changes at most once an hour.
  const hours = Math.max(0, Math.ceil((v.closesAt.getTime() - v.now.getTime()) / 3_600_000));
  return hours <= 1
    ? `Ends within the hour (${utc(v.closesAt)})`
    : `~${hours}h left (ends ${utc(v.closesAt)})`;
}

function counterLine(s: RaidStats): string | null {
  if (s.replies + s.quotes === 0) return null;
  return [
    `👥 ${plural(s.members, "member", "members")}`,
    `💬 ${plural(s.replies, "reply", "replies")}`,
    `🔁 ${plural(s.quotes, "quote", "quotes")}`,
    ...(s.averageCredited === null ? [] : [`⭐ avg ${s.averageCredited}`]),
  ].join(" · ");
}

// The longest prefix whose escaped form fits, so no HTML entity is ever cut in half.
function fitEscaped(text: string, room: number): string {
  if (escapeHtml(text).length <= room) return escapeHtml(text);
  let kept = "";
  for (const point of text) {
    if (escapeHtml(kept + point).length + 1 > room) break;
    kept += point;
  }
  return `${escapeHtml(kept)}…`;
}

export function cardCaption(v: CardView, tgTime = TG_TIME_IN_CAPTIONS): string {
  const who = v.handle ? `@${escapeHtml(v.handle)}` : "this post";
  if (v.state === "cancelled")
    return [
      `Raid cancelled: ${who}`,
      ...(v.cancelReason ? [fitEscaped(v.cancelReason, 900)] : []),
    ].join("\n");
  if (v.state === "ended")
    return [
      `⚫ <b>Raid closed</b>: ${who}`,
      `Ran ${span(v.ranMs)} · ${plural(v.stats.members, "member", "members")} · ${plural(v.stats.replies + v.stats.quotes, "contribution", "contributions")}`,
    ].join("\n");
  const counters = counterLine(v.stats);
  const head = [`🔴 <b>Raid live</b>: ${who}`, endsLine(v, tgTime)];
  const tail = [
    `Full credit for the first ${v.fullUntilMinutes / 60}h, then it decays.`,
    ...(counters ? [counters] : []),
  ];
  const brief = v.brief.trim();
  const room = CAPTION_LIMIT - [...head, ...tail].join("\n").length - "\nBrief: ".length;
  return [...head, ...(brief ? [`Brief: ${fitEscaped(brief, room)}`] : []), ...tail].join("\n");
}

// Open: engage on X (blue), then submit privately (green). Closed: only the results, once posted.
export function cardKeyboard(
  state: CardState,
  botUsername: string,
  taskId: string,
  postUrl: string,
  resultsUrl: string | null,
): InlineKeyboard {
  if (state !== "open")
    return resultsUrl ? new InlineKeyboard().url("📊 Results", resultsUrl) : new InlineKeyboard([]);
  const keyboard = new InlineKeyboard();
  const [reply, quote] = engageLinks(postUrl);
  if (reply && quote)
    keyboard
      .url(`💬 ${reply.label}`, reply.url)
      .primary()
      .url(`🔁 ${quote.label}`, quote.url)
      .primary()
      .row();
  else if (reply) keyboard.url(reply.label, reply.url).row();
  return keyboard
    .url("✅ Submit reply", `https://t.me/${botUsername}?start=reply_${taskId}`)
    .success()
    .url("✅ Submit quote", `https://t.me/${botUsername}?start=quote_${taskId}`)
    .success();
}

// Only a supergroup's messages have t.me links.
export function messageLink(chatId: bigint, messageId: number): string | null {
  const SUPERGROUPS = 1_000_000_000_000n;
  return chatId <= -SUPERGROUPS ? `https://t.me/c/${-chatId - SUPERGROUPS}/${messageId}` : null;
}

export const renderHash = (caption: string, keyboard: InlineKeyboard) =>
  createHash("sha256")
    .update(caption)
    .update("\n")
    .update(JSON.stringify(keyboard.inline_keyboard))
    .digest("hex");
