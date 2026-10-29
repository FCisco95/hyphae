// Copy rule (Cisco, 2026-10-29): a post that is at least 95% the same as an earlier post that
// earned points is a copy and earns nothing. Similar topic or style is not a copy, and length is
// never a signal: the comparison is relative, character for character.
export const COPY_THRESHOLD_BPS = 9_500;

const BPS = 10_000;

// What the rule ignores when comparing: case, spacing, links, @mentions and emoji.
export function copyNormalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\bt\.co\/\S+/g, " ")
    .replace(/@[a-z0-9_]{1,15}/g, " ")
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein distance, exact up to `limit`; any larger distance returns `limit + 1`. Only the
// diagonal band of width `limit` is computed, so a long post costs O(length * limit).
function boundedDistance(a: readonly string[], b: readonly string[], limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const over = limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => (j <= limit ? j : over));
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1).fill(over);
    if (i <= limit) current[0] = i;
    const from = Math.max(1, i - limit);
    const to = Math.min(b.length, i + limit);
    let rowMin = current[0] ?? over;
    for (let j = from; j <= to; j++) {
      const substitution = (previous[j - 1] ?? over) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const deletion = (previous[j] ?? over) + 1;
      const insertion = (current[j - 1] ?? over) + 1;
      const best = Math.min(substitution, deletion, insertion, over);
      current[j] = best;
      if (best < rowMin) rowMin = best;
    }
    if (rowMin > limit) return over;
    previous = current;
  }
  return Math.min(previous[b.length] ?? over, over);
}

export function isCopy(
  candidate: string,
  earlier: string,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean {
  if (!Number.isInteger(thresholdBps) || thresholdBps < 1 || thresholdBps > BPS) {
    throw new RangeError("thresholdBps must be an integer from 1 to 10000");
  }
  const a = Array.from(copyNormalize(candidate));
  const b = Array.from(copyNormalize(earlier));
  // Nothing left to compare (a bare link or emoji) is never a copy of anything.
  if (a.length === 0 || b.length === 0) return false;
  const longest = Math.max(a.length, b.length);
  const limit = Math.floor(((BPS - thresholdBps) * longest) / BPS);
  return boundedDistance(a, b, limit) <= limit;
}

// `earlier` is ordered by acceptance (server clock, then intake id); the first match is the original.
export function firstCopyOf<T extends { text: string }>(
  candidate: string,
  earlier: readonly T[],
  thresholdBps: number = COPY_THRESHOLD_BPS,
): T | undefined {
  return earlier.find((post) => isCopy(candidate, post.text, thresholdBps));
}
