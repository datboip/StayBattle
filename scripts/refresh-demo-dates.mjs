#!/usr/bin/env node
/**
 * Update the demo battle's check-in/check-out dates to roll forward
 * relative to "today" — so the demo always shows an upcoming trip.
 *
 * Designed to be invoked from the nightly reset cron after the fixture
 * has been restored. Idempotent.
 *
 * Usage:
 *   STAYBATTLE_DB=/var/lib/staybattle/quickie.db node scripts/refresh-demo-dates.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.STAYBATTLE_DB ?? "/var/lib/staybattle/quickie.db";
const DAYS_OUT = 30;
const STAY_LENGTH = 7;

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

const checkIn = new Date(Date.now() + DAYS_OUT * 24 * 3600 * 1000);
const checkOut = new Date(Date.now() + (DAYS_OUT + STAY_LENGTH) * 24 * 3600 * 1000);

const db = new Database(DB_PATH);

const row = db.prepare("select value from settings where key='battle'").get();
if (!row) {
  console.error("no battle in settings — is this the right DB?");
  process.exit(1);
}
const battle = JSON.parse(row.value);
const before = { check_in: battle.check_in, check_out: battle.check_out };
battle.check_in = isoDay(checkIn);
battle.check_out = isoDay(checkOut);

db.prepare("update settings set value = ? where key='battle'").run(
  JSON.stringify(battle),
);

// Re-bake the cached availability against the new date pair so the
// demo doesn't try (and fail) to call Airbnb's GraphQL after the
// dates roll forward.
const datesKey = `${battle.check_in}_${battle.check_out}`;
const reBake = db.prepare(
  `update listings set
     availability_dates_key = ?,
     availability_checked_at = datetime('now')
   where availability_status is not null`,
);
const r = reBake.run(datesKey);

console.log(
  `  battle dates: ${before.check_in} → ${before.check_out}  ⇒  ${battle.check_in} → ${battle.check_out}`,
);
console.log(`  refreshed dates_key on ${r.changes} listings`);
