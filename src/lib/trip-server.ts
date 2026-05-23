import "server-only";
import { db } from "./db";
import type { TripDates } from "./trip";

const KEY_IN = "trip_check_in";
const KEY_OUT = "trip_check_out";

export function getTripDates(): TripDates {
  const rows = db
    .prepare("select key, value from settings where key in (?, ?)")
    .all(KEY_IN, KEY_OUT) as { key: string; value: string }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    checkIn: map.get(KEY_IN) ?? null,
    checkOut: map.get(KEY_OUT) ?? null,
  };
}

export function setTripDates(dates: TripDates): void {
  const stmt = db.prepare(
    `insert into settings (key, value, updated_at) values (?, ?, datetime('now'))
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
  );
  const del = db.prepare("delete from settings where key = ?");
  if (dates.checkIn) stmt.run(KEY_IN, dates.checkIn);
  else del.run(KEY_IN);
  if (dates.checkOut) stmt.run(KEY_OUT, dates.checkOut);
  else del.run(KEY_OUT);
}
