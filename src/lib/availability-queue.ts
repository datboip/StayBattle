import "server-only";
import { db } from "./db";
import { datesKey, graphqlResultToStatus } from "./availability";
import {
  checkAvailabilityGraphQL,
  roomIdFromUrl,
  type AvailabilityResult,
} from "./airbnb-graphql";
import type { AvailabilityStatus } from "./types";

/**
 * Sequential per-process queue of availability checks. Requests run one
 * at a time with ~1-2s spacing to honor reasonable per-host pacing.
 */

declare global {
  // eslint-disable-next-line no-var
  var __availability_queue:
    | {
        running: boolean;
        pending: Array<{ id: string; url: string; checkIn: string; checkOut: string }>;
      }
    | undefined;
}

const state =
  globalThis.__availability_queue ??
  (globalThis.__availability_queue = { running: false, pending: [] });

// 1.2s gap between requests — drains 24 listings in ~30s, well within
// conservative per-host pacing. Combined with the 30-min freshness cache
// (skip listings checked recently), repeated organizer "recheck" clicks
// are no-ops, so spam-clicking won't accelerate the queue either.
const DELAY_BETWEEN_MS = 1200;

async function drain() {
  if (state.running) return;
  state.running = true;
  try {
    while (state.pending.length > 0) {
      const task = state.pending.shift()!;
      let result: AvailabilityResult | null = null;
      try {
        const roomId = roomIdFromUrl(task.url);
        if (roomId) {
          result = await checkAvailabilityGraphQL(
            roomId,
            task.checkIn,
            task.checkOut,
          );
        }
      } catch {}
      const status: AvailabilityStatus = result
        ? graphqlResultToStatus(result)
        : "unknown";
      try {
        db.prepare(
          `update listings
             set availability_status = ?,
                 availability_dates_key = ?,
                 availability_checked_at = datetime('now'),
                 price_display = ?,
                 amenities = ?,
                 cancellation_policy = ?,
                 unavailability_reason = ?
           where id = ?`,
        ).run(
          status,
          datesKey(task.checkIn, task.checkOut),
          result?.priceDisplay ?? null,
          result ? JSON.stringify(result.amenities) : null,
          result?.cancellationPolicy ?? null,
          result?.reason ?? null,
          task.id,
        );
      } catch {}
      if (state.pending.length > 0) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
      }
    }
  } finally {
    state.running = false;
  }
}

/**
 * Enqueue every listing for a fresh check against the given dates.
 *
 * @param force  If true, ignores the 30-minute cache and re-queues every
 *               listing even if it was just checked. Use sparingly — this
 *               is the path that risks hitting Airbnb's rate limiter on
 *               repeated invocation. The UI guards this behind a confirm
 *               dialog so an organizer can't trigger it accidentally.
 */
export function queueAllListings(
  checkIn: string,
  checkOut: string,
  force = false,
) {
  // Public demo uses pre-baked availability statuses, no live calls.
  // Self-hosters with STAYBATTLE_DEMO_MODE unset get the normal
  // queue behavior.
  if (process.env.STAYBATTLE_DEMO_MODE === "true") return;

  const rows = db
    .prepare("select id, url from listings")
    .all() as { id: string; url: string }[];

  if (force) {
    // Bypass the cache filter — re-queue every single listing.
    for (const r of rows) {
      state.pending.push({ id: r.id, url: r.url, checkIn, checkOut });
    }
    void drain();
    return;
  }

  const key = datesKey(checkIn, checkOut);
  // Skip listings whose cached check is already against these exact dates
  // AND was checked in the last 30 minutes.
  const cached = db
    .prepare(
      `select id from listings
       where availability_dates_key = ?
         and availability_checked_at > datetime('now', '-30 minutes')`,
    )
    .all(key) as { id: string }[];
  const fresh = new Set(cached.map((r) => r.id));
  for (const r of rows) {
    if (fresh.has(r.id)) continue;
    state.pending.push({ id: r.id, url: r.url, checkIn, checkOut });
  }
  void drain();
}

/** Enqueue a single listing — used after adding a new URL when dates are set. */
export function queueOne(id: string, url: string, checkIn: string, checkOut: string) {
  state.pending.push({ id, url, checkIn, checkOut });
  void drain();
}

/** Clear the cached availability for every listing. */
export function clearAllAvailability() {
  db.prepare(
    `update listings
       set availability_status = null,
           availability_dates_key = null,
           availability_checked_at = null`,
  ).run();
}
