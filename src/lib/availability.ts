import type { AvailabilityStatus } from "./types";
import {
  checkAvailabilityGraphQL,
  roomIdFromUrl,
  type AvailabilityResult,
} from "./airbnb-graphql";

/**
 * Whether the dates are bookable for a given Airbnb listing.
 *
 * Hits Airbnb's internal GraphQL endpoint (see ./airbnb-graphql.ts for the
 * protocol). This is the same call airbnb.com fires client-side ~200ms
 * after page load to fill in the booking widget. SSR HTML doesn't carry
 * the answer — only this endpoint does.
 *
 * Returns:
 *   - "available"   when the booking widget says these exact dates work
 *   - "unavailable" when Airbnb refuses (booked, min-stay, blocked, etc.)
 *   - "unknown"     when we can't tell — network error, hash rotated,
 *                   bad URL, inverted date range, etc. Caller decides
 *                   what to do with this (probably "show verify link").
 *
 * Important: Airbnb silently accepts inverted date ranges and returns
 * available=true for nonsense like checkout < checkin. The caller MUST
 * validate `checkOut > checkIn` first; we double-check here.
 */
export async function checkAvailability(
  url: string,
  checkIn: string,
  checkOut: string,
): Promise<AvailabilityStatus> {
  if (!(new Date(checkOut) > new Date(checkIn))) return "unknown";

  const roomId = roomIdFromUrl(url);
  if (!roomId) return "unknown";

  const result = await checkAvailabilityGraphQL(roomId, checkIn, checkOut);
  return graphqlResultToStatus(result);
}

/**
 * Map the rich GraphQL result down to our three-state availability enum.
 * Exposed so the queue can store the original `reason` / `priceDisplay`
 * alongside the bucketed status when we wire those columns up.
 */
export function graphqlResultToStatus(
  result: AvailabilityResult,
): AvailabilityStatus {
  if (result.error) return "unknown";
  if (result.available) return "available";
  return "unavailable";
}

/**
 * Stable key encoding for caching: same (check-in, check-out) pair → same
 * key. Lets us avoid re-checking listings whose dates haven't changed.
 */
export function datesKey(checkIn: string, checkOut: string): string {
  return `${checkIn}_${checkOut}`;
}

/**
 * Kept for back-compat: the old static-HTML parser. It always returns
 * "unknown" now (the mediaTour signal we used to read turned out to be
 * a photo-tour feature flag, not a per-date booking signal — 85%
 * coincidental correlation, 15% silent lie). The real check happens in
 * checkAvailability above. This function exists only so any caller that
 * happens to import it gets a safe default rather than a missing symbol.
 *
 * @deprecated use checkAvailability + the GraphQL caller instead.
 */
export function parseAvailability(_html: string): AvailabilityStatus {
  return "unknown";
}
