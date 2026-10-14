import { type PointUnits, wholePoints } from "@hyphae/core";
import { plural, type RaidContribution, type RaidStats, span } from "../raid-alerts/stats.js";
import { escapeHtml } from "./html.js";

export interface ResultsRow {
  handle: string | null;
  points: bigint;
  posts: { kind: "reply" | "quote"; url: string | null }[];
}

// Credited members only, most points first; a tie goes to whoever submitted first.
export function rankResults(contributions: RaidContribution[]): ResultsRow[] {
  const byMember = new Map<
    string,
    { units: bigint; best: RaidContribution; first: number; posts: RaidContribution[] }
  >();
  for (const c of contributions) {
    if (!c.credited) continue;
    const m = byMember.get(c.memberId);
    if (!m) {
      byMember.set(c.memberId, {
        units: c.pointUnits,
        best: c,
        first: c.submittedAt.getTime(),
        posts: [c],
      });
      continue;
    }
    m.units += c.pointUnits;
    m.posts.push(c);
    m.first = Math.min(m.first, c.submittedAt.getTime());
    if (c.pointUnits > m.best.pointUnits) m.best = c;
  }
  return [...byMember.values()]
    .sort((a, b) => (a.units === b.units ? a.first - b.first : a.units > b.units ? -1 : 1))
    .map((m) => ({
      handle: m.best.handle,
      points: wholePoints(m.units as PointUnits),
      posts: m.posts
        .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
        .map((p) => ({ kind: p.kind, url: p.url })),
    }));
}

export interface ResultsInput {
  handle: string | null;
  ranMs: number;
  stats: RaidStats;
  rows: ResultsRow[];
  webBase: string;
  mint: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const LIMIT = 4096;

function rowLine(r: ResultsRow, i: number) {
  const posts = r.posts
    .map((p) => (p.url ? `<a href="${escapeHtml(p.url)}">${p.kind}</a>` : p.kind))
    .join(" · ");
  return `${MEDALS[i] ?? `${i + 1}.`} ${r.handle ? `@${r.handle}` : "a member"}: ${r.points} pts · ${posts}`;
}

// Public group text at a raid's close: everyone is counted, only members with credit are named.
export function resultsText(r: ResultsInput): string {
  const s = r.stats;
  const total = s.replies + s.quotes;
  const base = r.webBase.replace(/\/$/, "");
  const links = s.epochs.length
    ? s.epochs.map((n) => `Epoch ${n} results: ${base}/c/${r.mint}/e/${n}`)
    : [`Results: ${base}/c/${r.mint}`];
  const head = [
    `⚫ <b>Raid results</b>: ${r.handle ? `@${escapeHtml(r.handle)}` : "this post"} (ran ${span(r.ranMs)})`,
    ...(total
      ? [
          `${s.members} took part · ${plural(total, "contribution", "contributions")} · ${s.credited} credited · ${total - s.credited - s.scoring} without credit`,
          ...(s.averageCredited === null ? [] : [`Average credited score ${s.averageCredited}`]),
          ...(s.scoring ? [`${s.scoring} still being scored and may be credited later.`] : []),
        ]
      : ["No submissions."]),
  ];
  const lines = r.rows.map(rowLine);
  const build = (shown: number) => {
    const top = lines.slice(0, Math.min(3, shown));
    const rest = lines.slice(3, shown);
    return [
      ...head,
      ...(top.length ? ["", ...top] : []),
      ...(rest.length ? [`<blockquote expandable>${rest.join("\n")}</blockquote>`] : []),
      ...(shown < lines.length ? [`${lines.length - shown} more on the epoch page.`] : []),
      ...links,
    ].join("\n");
  };
  let shown = lines.length;
  let text = build(shown);
  while (text.length > LIMIT && shown > 0) text = build(--shown);
  return text;
}
