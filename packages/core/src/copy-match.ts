// Copy rule (Cisco, 2026-10-29): a post that is at least 95% the same as an earlier post that
// earned points is a copy and earns nothing. Similar topic or style is not a copy, and length is
// never a signal: the comparison is relative, character for character.
export const COPY_THRESHOLD_BPS = 9_500;

const BPS = 10_000;

// A link: a scheme or www with everything after it, X's own short hosts, a domain followed by a
// path, query or fragment, or a bare domain whatever its top-level domain. A dotted token that ends
// in letters (example.network, node.js) reads as a domain; abbreviations (p.m., e.g.) and numbers
// (3.14) do not.
const LINK = new RegExp(
  [
    String.raw`(?:https?:\/\/|www\.)\S+`,
    String.raw`\b(?:t\.co|pic\.twitter\.com|pic\.x\.com)\/\S*`,
    String.raw`\b(?:[a-z0-9-]+\.)+[a-z]{2,}[/?#]\S*`,
    String.raw`\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b`,
  ].join("|"),
  "g",
);
const KEYCAP = /[0-9#*]\u{FE0F}?\u{20E3}/gu;
// Tag characters (U+E0020 to U+E007F) carry the subdivision of a flag such as England's.
const EMOJI =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[\u{E0020}-\u{E007F}]|\u{200D}|[\u{FE0E}\u{FE0F}]/gu;

// What the rule ignores when comparing: case, spacing, links, @mentions and emoji. Emoji go before
// the compatibility folding, which would otherwise turn some of them (TM, !!) into plain text.
export function copyNormalize(text: string): string {
  return text
    .replace(KEYCAP, "")
    .replace(EMOJI, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(LINK, " ")
    .replace(/@[a-z0-9_]{1,15}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A post prepared once for many comparisons.
export interface CopyKey {
  text: string;
  chars: Uint32Array;
  counts: Map<number, number>;
}

export function copyKey(text: string): CopyKey {
  const normalized = copyNormalize(text);
  const chars = Uint32Array.from(normalized, (c) => c.codePointAt(0) ?? 0);
  const counts = new Map<number, number>();
  for (const c of chars) counts.set(c, (counts.get(c) ?? 0) + 1);
  return { text: normalized, chars, counts };
}

// Half the difference between the two character histograms never exceeds the edit distance, so a
// pair above the limit here is rejected without the quadratic work.
function histogramBound(a: CopyKey, b: CopyKey): number {
  let difference = 0;
  for (const [c, n] of a.counts) difference += Math.abs(n - (b.counts.get(c) ?? 0));
  for (const [c, n] of b.counts) if (!a.counts.has(c)) difference += n;
  return Math.ceil(difference / 2);
}

// Levenshtein distance, exact up to `limit`; any larger distance returns `limit + 1`. Only the
// diagonal band of width `limit` is computed, over two reused rows.
function boundedDistance(a: Uint32Array, b: Uint32Array, limit: number): number {
  const over = limit + 1;
  if (Math.abs(a.length - b.length) > limit) return over;
  let previous = new Int32Array(b.length + 1).fill(over);
  let current = new Int32Array(b.length + 1).fill(over);
  for (let j = 0; j <= Math.min(b.length, limit); j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const from = Math.max(1, i - limit);
    const to = Math.min(b.length, i + limit);
    current[from - 1] = from === 1 && i <= limit ? i : over;
    let rowMin = current[from - 1] as number;
    const symbol = a[i - 1];
    for (let j = from; j <= to; j++) {
      const substitution = (previous[j - 1] as number) + (symbol === b[j - 1] ? 0 : 1);
      const deletion = (previous[j] as number) + 1;
      const insertion = (current[j - 1] as number) + 1;
      const best = Math.min(substitution, deletion, insertion, over);
      current[j] = best;
      if (best < rowMin) rowMin = best;
    }
    if (to < b.length) current[to + 1] = over;
    if (rowMin > limit) return over;
    [previous, current] = [current, previous];
  }
  return Math.min(previous[b.length] as number, over);
}

// Positions that differ when the two are laid side by side; an upper bound on the distance when
// they have the same length.
function hammingWithin(a: Uint32Array, b: Uint32Array, limit: number): boolean {
  let differing = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && ++differing > limit) return false;
  }
  return true;
}

function limitFor(candidate: CopyKey, earlier: CopyKey, thresholdBps: number): number {
  if (!Number.isInteger(thresholdBps) || thresholdBps < 1 || thresholdBps > BPS) {
    throw new RangeError("thresholdBps must be an integer from 1 to 10000");
  }
  const longest = Math.max(candidate.chars.length, earlier.chars.length);
  return Math.floor(((BPS - thresholdBps) * longest) / BPS);
}

// The answer when it costs no more than a linear pass, or undefined when only the edit distance
// can tell. A caller that has to bound its work counts the undefined ones.
export function quickCopyVerdict(
  candidate: CopyKey,
  earlier: CopyKey,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean | undefined {
  const limit = limitFor(candidate, earlier, thresholdBps);
  // Nothing left to compare (a bare link or emoji) is never a copy of anything.
  if (candidate.chars.length === 0 || earlier.chars.length === 0) return false;
  if (candidate.text === earlier.text) return true;
  if (Math.abs(candidate.chars.length - earlier.chars.length) > limit) return false;
  if (histogramBound(candidate, earlier) > limit) return false;
  if (
    candidate.chars.length === earlier.chars.length &&
    hammingWithin(candidate.chars, earlier.chars, limit)
  ) {
    return true;
  }
  return undefined;
}

// The edit-distance answer, for the pairs quickCopyVerdict leaves open.
export function editCopyVerdict(
  candidate: CopyKey,
  earlier: CopyKey,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean {
  const limit = limitFor(candidate, earlier, thresholdBps);
  const a = candidate.chars;
  const b = earlier.chars;
  // Text both posts share at either end does not change the distance and is not worked through.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return boundedDistance(a.subarray(start, endA), b.subarray(start, endB), limit) <= limit;
}

export function isCopyKey(
  candidate: CopyKey,
  earlier: CopyKey,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean {
  return (
    quickCopyVerdict(candidate, earlier, thresholdBps) ??
    editCopyVerdict(candidate, earlier, thresholdBps)
  );
}

export function isCopy(
  candidate: string,
  earlier: string,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean {
  return isCopyKey(copyKey(candidate), copyKey(earlier), thresholdBps);
}

// `earlier` is ordered by acceptance (server clock, then intake id); the first match is the original.
export function firstCopyOf<T extends { text: string }>(
  candidate: string,
  earlier: readonly T[],
  thresholdBps: number = COPY_THRESHOLD_BPS,
): T | undefined {
  const key = copyKey(candidate);
  return earlier.find((post) => isCopyKey(key, copyKey(post.text), thresholdBps));
}
