/**
 * Drive-time distance via OSRM table API.
 *
 * For "Nearby" pills on listing cards, straight-line haversine is a
 * fine first pass but a 12km-as-the-crow-flies place might be 35min
 * around a lake. Real drive time settles arguments better.
 *
 * v1 hits the public OSRM demo server (router.project-osrm.org).
 * Rate-limited but fine for a demo-mode app. When the app is past
 * demo mode and traffic grows, self-host OSRM (multi-GB extract +
 * preprocess) and point OSRM_BASE_URL at it.
 *
 * Failures (timeout, non-200, malformed response) return null —
 * callers should fall back to the haversine display so the row
 * still renders if OSRM is unreachable.
 */

const OSRM_BASE_URL =
  process.env.STAYBATTLE_OSRM_URL ?? "https://router.project-osrm.org";

/**
 * Request timeout (ms). OSRM demo can be slow under load; keep this
 * conservative so a hanging fetch doesn't tank the SSR latency.
 */
const TIMEOUT_MS = 4000;

export type LngLat = { lat: number; lng: number };

/**
 * Compute the N×M drive-time matrix between `origins` and `destinations`.
 * Result rows = origins, columns = destinations. Each cell is the
 * estimated drive duration in seconds, or null if OSRM couldn't route
 * (disconnected island, no road network, etc.).
 *
 * Returns null on transport failure (network error, timeout, non-200,
 * unparseable response) so the caller can degrade to haversine.
 */
export async function fetchDriveMatrix(
  origins: LngLat[],
  destinations: LngLat[],
): Promise<(number | null)[][] | null> {
  if (origins.length === 0 || destinations.length === 0) return null;

  // OSRM `table` endpoint accepts a single coordinate list and uses
  // `sources=` / `destinations=` indexes to specify which entries are
  // origins vs targets. Combining into one list halves the URL length.
  const coords = [...origins, ...destinations]
    .map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`)
    .join(";");
  const sourceIdx = origins.map((_, i) => i).join(";");
  const destIdx = destinations.map((_, i) => origins.length + i).join(";");

  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coords}` +
    `?sources=${sourceIdx}&destinations=${destIdx}&annotations=duration`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "staybattle/1.0 (+https://staybattle.com)" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      durations?: (number | null)[][];
    };
    if (json.code !== "Ok" || !Array.isArray(json.durations)) return null;
    // Defensive shape check: every row should match destinations.length.
    for (const row of json.durations) {
      if (!Array.isArray(row) || row.length !== destinations.length) {
        return null;
      }
    }
    return json.durations;
  } catch {
    // AbortError (timeout) or any network error — degrade.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compact drive-time label: <60s → "<1min", <60min → "Nmin",
 * else "Hh Mmin". OSRM returns seconds.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return "<1min";
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds - hours * 3600) / 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}
