import type { ListingWithStats } from "./types";

export type SortMode = "score" | "votes" | "recent";

/**
 * Sort cards by mean 1–5 rating with a fading recency boost so fresh listings
 * get a brief window at the top before they've accumulated ratings. Listings
 * with zero votes sort below any listing with at least one vote.
 *
 * Recency boost is small (max +0.5) because the score range is only 1–5 —
 * a too-large boost would let a brand-new unrated listing outrank a 5★ one.
 * Hyperbolic decay — fast first, then slow.
 */
function scoreRank(l: ListingWithStats, now: number): number {
  const ageHours = Math.max(0, (now - new Date(l.created_at).getTime()) / 3_600_000);
  const recencyBoost = 0.5 / (1 + ageHours);
  // Unrated listings (score === null) start from below the lowest possible
  // rating so any rated listing beats them, but they still benefit from
  // recency among themselves.
  const baseScore = l.score ?? 0;
  return baseScore + recencyBoost;
}

/**
 * Lower bucket number = ranked higher. Available listings come first, unknown
 * next, booked last — regardless of score. An organizer override wins over
 * the auto-check in either direction.
 */
function availabilityBucket(l: ListingWithStats): number {
  // Override wins if present.
  if (l.availability_override_status === "available") return 0;
  if (l.availability_override_status === "unavailable") return 2;
  // Backwards-compat: legacy overrides without a status column were always
  // "mark available." Treat them that way.
  if (l.availability_override && !l.availability_override_status) return 0;
  if (l.availability_status === "available") return 0;
  if (l.availability_status === "unavailable") return 2;
  return 1; // null or "unknown"
}

export function rankListings(
  listings: ListingWithStats[],
  mode: SortMode = "score",
): ListingWithStats[] {
  const now = Date.now();

  const compareWithin: (a: ListingWithStats, b: ListingWithStats) => number =
    mode === "recent"
      ? (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : mode === "votes"
        ? (a, b) => {
            if (a.vote_count !== b.vote_count) return b.vote_count - a.vote_count;
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          }
        : (a, b) => {
            const diff = scoreRank(b, now) - scoreRank(a, now);
            if (diff !== 0) return diff;
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          };

  return [...listings].sort((a, b) => {
    const ba = availabilityBucket(a);
    const bb = availabilityBucket(b);
    if (ba !== bb) return ba - bb;
    return compareWithin(a, b);
  });
}

/** Filter helper for the "hide booked" toggle. */
export function isDisqualified(l: ListingWithStats): boolean {
  if (l.availability_override_status === "available") return false;
  if (l.availability_override_status === "unavailable") return true;
  if (l.availability_override && !l.availability_override_status) return false;
  return l.availability_status === "unavailable";
}
