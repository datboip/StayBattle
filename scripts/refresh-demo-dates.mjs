#!/usr/bin/env node
/**
 * Roll the demo battle's dates forward AND defensively re-establish
 * availability state so the demo always looks current.
 *
 * Runs from the nightly cron after the fixture is restored. Idempotent
 * and self-healing — if anything (app cleanup hook, queue, manual edit)
 * has wiped availability data, this puts it back deterministically.
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

// 1. Roll battle dates forward
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
const datesKey = `${battle.check_in}_${battle.check_out}`;

// 2. Stamp the cleanup flag so the app's one-shot wipe in db.ts NEVER runs.
// (Without this, every fresh service boot wipes status + dates_key.)
db.prepare(
  "insert or replace into settings (key, value) values ('availability_reset_v1', ?)",
).run(new Date().toISOString());

// 3. Defensively re-bake availability for EVERY listing — 70/20/10 mix of
// available/unavailable/unknown. Doesn't matter what cleared things in
// between; after this runs, every listing has resolved status + dates_key.
// Skip listings that have an organizer override (user-verified — leave alone).
const listings = db.prepare(
  "select id from listings where availability_override_status is null",
).all();
const setAvail = db.prepare(
  `update listings set
     availability_status = ?,
     availability_dates_key = ?,
     availability_checked_at = datetime('now'),
     unavailability_reason = ?
   where id = ?`,
);
let counts = { available: 0, unavailable: 0, unknown: 0 };
listings.forEach((row, i) => {
  const m = i % 10;
  if (m < 7) {
    setAvail.run("available", datesKey, null, row.id);
    counts.available++;
  } else if (m < 9) {
    setAvail.run("unavailable", datesKey, "Not available for these dates", row.id);
    counts.unavailable++;
  } else {
    setAvail.run("unknown", datesKey, null, row.id);
    counts.unknown++;
  }
});

console.log(
  `  battle dates: ${before.check_in} → ${before.check_out}  ⇒  ${battle.check_in} → ${battle.check_out}`,
);
console.log(`  cleanup flag stamped (one-shot wipe disarmed)`);
console.log(
  `  availability re-baked: ${counts.available} available · ${counts.unavailable} unavailable · ${counts.unknown} unknown`,
);
