#!/usr/bin/env node
/**
 * Operator-level takedown tool.
 *
 *   node scripts/admin/remove-url.mjs <url> [reason]
 *
 * Removes the listing matching <url> from the current and any future
 * battles, and adds the URL to `blocked_urls` so a re-add is refused.
 * Cascades to votes + comments via the foreign-key relation on
 * listings.id. Past-battle archives are NOT touched — those rows are
 * snapshots with a scrubbed URL anyway, so the listing identity is
 * already moot in the trophy case.
 *
 * Use cases:
 *   - DMCA takedown from a property owner
 *   - "Host doesn't want this on the platform" opt-out
 *   - Spam / unfit content reported by an organizer
 *
 * Auth model: the script reads the DB directly via better-sqlite3.
 * Run it on the VPS as the same user the app runs as (root in our
 * systemd unit). Anyone with shell on the VPS can take down a URL —
 * matches the existing "the operator owns the box" auth model.
 *
 * To reverse a takedown:
 *   sqlite3 $DB "delete from blocked_urls where url = '<canonical url>'"
 *
 * To list current takedowns:
 *   sqlite3 $DB "select url, reason, blocked_at from blocked_urls
 *                order by blocked_at desc"
 */
import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB = join(__dirname, "..", "..", "data", "quickie.db");
const DB_PATH = process.env.STAYBATTLE_DB_DIR
  ? join(process.env.STAYBATTLE_DB_DIR, "quickie.db")
  : DEFAULT_DB;

const [, , urlArg, ...reasonParts] = process.argv;
const reason = reasonParts.join(" ").trim() || null;

if (!urlArg) {
  console.error("usage: remove-url.mjs <url> [reason]");
  console.error("");
  console.error("Example:");
  console.error('  remove-url.mjs https://www.airbnb.com/rooms/12345 "DMCA from owner 2026-05-27"');
  process.exit(2);
}

if (!existsSync(DB_PATH)) {
  console.error(`DB not found at ${DB_PATH}`);
  console.error("Set STAYBATTLE_DB_DIR if it lives somewhere else.");
  process.exit(2);
}

// Same canonicalization the app uses on insert. Keep this in sync with
// validateAirbnbUrl / normalizeUrl — pasting a duplicate query-string
// variant should match the same row.
function canonicalize(url) {
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/\/rooms(?:\/[a-z_]+)?\/(\d+)/i);
    if (m) return `https://www.airbnb.com/rooms/${m[1]}`;
  } catch {}
  return url.trim();
}

const canonical = canonicalize(urlArg);
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const existing = db
  .prepare("select id, title, added_by_name from listings where url = ?")
  .get(canonical);

const tx = db.transaction(() => {
  if (existing) {
    // Cascading FK on votes(listing_id) + comments(listing_id) cleans
    // up the social rows in the same statement.
    db.prepare("delete from listings where id = ?").run(existing.id);
  }
  db.prepare(
    `insert into blocked_urls (url, reason)
       values (?, ?)
       on conflict(url) do update set
         reason = excluded.reason,
         blocked_at = datetime('now')`,
  ).run(canonical, reason);
});
tx();

console.log("");
console.log("Takedown applied.");
console.log(`  URL:     ${canonical}`);
if (existing) {
  console.log(`  Title:   ${existing.title ?? "(no title)"}`);
  console.log(`  Added by: ${existing.added_by_name ?? "(unknown)"}`);
  console.log(`  Status:   listing row deleted, votes + comments cascaded`);
} else {
  console.log("  Status:   no live listing matched, URL added to blocklist anyway");
}
if (reason) console.log(`  Reason:  ${reason}`);
console.log("");
console.log("Future re-adds of this URL will be refused via addListing.");
db.close();
