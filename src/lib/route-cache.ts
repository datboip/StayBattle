import "server-only";
import { db } from "./db";

/**
 * Persistent cache for OSRM drive-time results, keyed by (listing, place).
 * Without it, the SSR drive-time matrix re-hit the public OSRM demo server
 * on every 6-second refresh — a few active voters could blow past its
 * 1-request/second ceiling. A route between two fixed points doesn't change,
 * so cached rows live effectively forever; OSRM is only called when a new
 * listing or place introduces an uncached pair.
 *
 * `seconds` of -1 is a sentinel for "OSRM returned no route" so those pairs
 * count as cached and don't trigger a re-fetch every render.
 */
export type Pair = { listingId: string; placeId: string };
export type RouteEntry = Pair & { seconds: number };

const key = (listingId: string, placeId: string) => `${listingId}:${placeId}`;

/**
 * Split `pairs` into the ones already cached (value may be -1) and the ones
 * still missing. Reads only the rows that matter.
 */
export function readRouteCache(pairs: Pair[]): {
  cached: Map<string, number>;
  missing: Pair[];
} {
  const cached = new Map<string, number>();
  if (pairs.length === 0) return { cached, missing: [] };

  const listingIds = [...new Set(pairs.map((p) => p.listingId))];
  const placeIds = [...new Set(pairs.map((p) => p.placeId))];
  const rows = db
    .prepare(
      `select listing_id, place_id, seconds from route_durations
        where listing_id in (${listingIds.map(() => "?").join(",")})
          and place_id in (${placeIds.map(() => "?").join(",")})`,
    )
    .all(...listingIds, ...placeIds) as {
    listing_id: string;
    place_id: string;
    seconds: number;
  }[];
  for (const r of rows) cached.set(key(r.listing_id, r.place_id), r.seconds);

  const missing = pairs.filter((p) => !cached.has(key(p.listingId, p.placeId)));
  return { cached, missing };
}

/** Upsert cache rows. `seconds` -1 records a known "no route". */
export function writeRouteCache(entries: RouteEntry[]): void {
  if (entries.length === 0) return;
  const stmt = db.prepare(
    `insert into route_durations (listing_id, place_id, seconds, computed_at)
     values (?, ?, ?, datetime('now'))
     on conflict (listing_id, place_id) do update set
       seconds = excluded.seconds, computed_at = excluded.computed_at`,
  );
  const tx = db.transaction((rows: RouteEntry[]) => {
    for (const e of rows) stmt.run(e.listingId, e.placeId, e.seconds);
  });
  tx(entries);
}
