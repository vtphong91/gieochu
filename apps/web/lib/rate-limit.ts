/**
 * In-memory rate limiter — §6: "bảng rate_limits trên Postgres hoặc in-memory
 * cho dev". Single-instance only (state is per Node process); fine for MVP,
 * revisit (Postgres-backed) if/when running multiple instances — see
 * docs/BACKLOG.md.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Test-only: clears all rate-limit state. */
export function resetRateLimits(): void {
  buckets.clear();
}
