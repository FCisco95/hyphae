export function tokenBucket({
  capacity,
  refillPerMinute,
  now = Date.now,
}: {
  capacity: number;
  refillPerMinute: number;
  now?: () => number;
}): (key: string) => boolean {
  const buckets = new Map<string, { tokens: number; last: number }>();
  // Integer credits avoid losing a replenished token at an exact boundary through rounding.
  const maxCredits = capacity * 60000;
  let nextSweep = 0;
  return (key) => {
    const time = now();
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 10000) {
        if (time < nextSweep) return false;
        nextSweep = time + 1000;
        for (const [id, entry] of buckets) {
          if (entry.tokens + Math.max(0, time - entry.last) * refillPerMinute >= maxCredits)
            buckets.delete(id);
        }
        if (buckets.size >= 10000) return false;
      }
      bucket = { tokens: maxCredits, last: time };
      buckets.set(key, bucket);
    }
    bucket.tokens = Math.min(
      maxCredits,
      bucket.tokens + Math.max(0, time - bucket.last) * refillPerMinute,
    );
    bucket.last = Math.max(time, bucket.last);
    if (bucket.tokens < 60000) return false;
    bucket.tokens -= 60000;
    return true;
  };
}
