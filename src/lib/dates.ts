// Pure date helpers for the check-in / check-out range fields. No timezone
// math needed — these are plain YYYY-MM-DD calendar strings, so we parse the
// parts by hand and use UTC to avoid a local-midnight off-by-one.

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day after `iso` (YYYY-MM-DD), or "" if `iso` is blank/invalid. */
export function nextDayIso(iso: string): string {
  const m = ISO.exec(iso);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Given a (possibly new) check-in, decide what check-out should be:
 * - no check-in yet → leave check-out as-is
 * - check-out empty, or now on/before check-in → day after check-in
 * - otherwise → unchanged
 */
export function resolveCheckOut(checkIn: string, checkOut: string): string {
  if (!ISO.test(checkIn)) return checkOut;
  if (!checkOut || checkOut <= checkIn) return nextDayIso(checkIn);
  return checkOut;
}
