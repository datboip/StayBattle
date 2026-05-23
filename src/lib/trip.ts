// Client-safe trip-dates helpers. No DB imports here — this file is bundled
// into the client too. Server-only DB access lives in `trip-server.ts`.

export type TripDates = {
  checkIn: string | null;
  checkOut: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Build the canonical Airbnb URL with trip dates appended, if both dates are
 * set. Leaves the URL untouched if dates are missing or invalid.
 */
export function withTripDates(url: string, dates: TripDates): string {
  if (!dates.checkIn || !dates.checkOut) return url;
  if (!isValidIsoDate(dates.checkIn) || !isValidIsoDate(dates.checkOut)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("check_in", dates.checkIn);
    u.searchParams.set("check_out", dates.checkOut);
    return u.toString();
  } catch {
    return url;
  }
}
