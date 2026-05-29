// Tiny in-memory token-bucket rate limiter.
// No Redis, no clustering — this is a single-process local app.
// If you ever run multiple processes, swap this for a real store.

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, Bucket>();

export type Limit = {
  /** Bucket capacity. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
};

export const LIMITS = {
  addListing: { capacity: 10, refillPerSecond: 10 / 60 }, // ~10/min sustained
  vote: { capacity: 60, refillPerSecond: 60 / 60 }, // ~1/sec sustained, burst 60
  comment: { capacity: 20, refillPerSecond: 20 / 60 }, // ~20/min sustained
  place: { capacity: 8, refillPerSecond: 8 / 60 },
  remove: { capacity: 30, refillPerSecond: 30 / 60 },
  signIn: { capacity: 5, refillPerSecond: 5 / 60 }, // 5 PIN attempts per minute per name
  // Per-battle ceiling for join attempts. Layered on top of the per-voter
  // signIn limit so an attacker rotating identities still can't brute the
  // invite code — at 20 capacity + 1/min refill, even a swarm gets ~20
  // tries before being throttled to a trickle.
  joinBattle: { capacity: 20, refillPerSecond: 1 / 60 },
} as const satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

/**
 * Returns true if the action is allowed. Consumes one token.
 * `subject` should be a stable per-actor key — typically `${action}:${voter_id}`
 * since identity comes from localStorage, not from request IP.
 */
export function consume(subject: string, limit: Limit): boolean {
  const now = Date.now();
  const existing = buckets.get(subject);
  if (!existing) {
    buckets.set(subject, { tokens: limit.capacity - 1, lastRefill: now });
    return true;
  }
  const elapsedSec = (now - existing.lastRefill) / 1000;
  const refilled = Math.min(
    limit.capacity,
    existing.tokens + elapsedSec * limit.refillPerSecond,
  );
  existing.lastRefill = now;
  if (refilled < 1) {
    existing.tokens = refilled;
    return false;
  }
  existing.tokens = refilled - 1;
  return true;
}

// Periodically prune very old buckets so we don't leak memory forever.
const PRUNE_INTERVAL_MS = 5 * 60_000;
const PRUNE_AFTER_MS = 60 * 60_000;
if (typeof setInterval === "function") {
  // Use unref so this never holds the event loop open.
  const handle = setInterval(() => {
    const cutoff = Date.now() - PRUNE_AFTER_MS;
    for (const [k, b] of buckets) {
      if (b.lastRefill < cutoff) buckets.delete(k);
    }
  }, PRUNE_INTERVAL_MS);
  if (typeof handle === "object" && handle && "unref" in handle) {
    (handle as { unref: () => void }).unref();
  }
}
