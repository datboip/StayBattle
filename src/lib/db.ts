import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

// DB location is overridable via STAYBATTLE_DB_DIR so a second instance
// (e.g. the screenshot demo seed) can run alongside the real app with
// its own database. Falls back to ./data for normal `npm run dev`.
const DB_DIR = process.env.STAYBATTLE_DB_DIR
  ? path.resolve(process.env.STAYBATTLE_DB_DIR)
  : path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "quickie.db");

mkdirSync(DB_DIR, { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __quickie_db: Database.Database | undefined;
}

const SCHEMA_STATEMENTS = [
  `create table if not exists listings (
    id text primary key,
    url text not null unique,
    airbnb_id text,
    title text,
    image_url text,
    photos text not null default '[]',
    price_per_night real,
    currency text,
    location text,
    latitude real,
    longitude real,
    bedrooms real,
    bathrooms real,
    beds real,
    max_guests integer,
    rating real,
    review_count integer,
    added_by_name text,
    added_by_id text,
    availability_status text,
    availability_dates_key text,
    availability_checked_at text,
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists votes (
    listing_id text not null references listings(id) on delete cascade,
    voter_id text not null,
    voter_name text not null,
    value integer not null check (value between 1 and 5),
    created_at text not null default (datetime('now')),
    primary key (listing_id, voter_id)
  )`,
  `create index if not exists votes_listing_idx on votes(listing_id)`,
  `create table if not exists comments (
    id text primary key,
    listing_id text not null references listings(id) on delete cascade,
    voter_id text not null,
    voter_name text not null,
    body text not null,
    created_at text not null default (datetime('now'))
  )`,
  `create index if not exists comments_listing_idx on comments(listing_id, created_at)`,
  `create table if not exists places (
    id text primary key,
    name text not null,
    url text,
    latitude real not null,
    longitude real not null,
    kind text not null default 'reference',
    added_by_name text,
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists voters (
    id text primary key,
    name text not null,
    name_key text not null unique,
    pin_hash text not null,
    created_at text not null default (datetime('now'))
  )`,
  `create index if not exists voters_name_key_idx on voters(name_key)`,
  `create table if not exists settings (
    key text primary key,
    value text not null,
    updated_at text not null default (datetime('now'))
  )`,
  `create table if not exists participants (
    battle_id text not null,
    voter_id text not null,
    voter_name text not null,
    joined_at text not null default (datetime('now')),
    primary key (battle_id, voter_id)
  )`,
  `create index if not exists participants_battle_idx on participants(battle_id)`,
  `create table if not exists past_battles (
    id text primary key,
    name text not null,
    check_in text,
    check_out text,
    organizer_name text,
    participant_names text not null default '[]',
    podium text not null default '[]',
    total_listings integer not null default 0,
    total_votes integer not null default 0,
    total_comments integer not null default 0,
    closed_at text not null default (datetime('now')),
    created_at text not null
  )`,
  `create index if not exists past_battles_closed_idx on past_battles(closed_at desc)`,
];

// Idempotent migrations for old databases that predate added columns.
const MIGRATIONS: { column: string; type: string }[] = [
  { column: "latitude", type: "real" },
  { column: "longitude", type: "real" },
  { column: "availability_status", type: "text" },
  { column: "availability_dates_key", type: "text" },
  { column: "availability_checked_at", type: "text" },
  { column: "added_by_id", type: "text" },
  // Organizer override — non-null text means "treat as available, here's why
  // the automatic check was wrong."
  { column: "availability_override", type: "text" },
  { column: "availability_override_by", type: "text" },
  { column: "availability_override_at", type: "text" },
  // Organizer-chosen status: 'available' or 'unavailable'. When set, this
  // wins over `availability_status` for ranking + display. Lets the
  // organizer correct false positives in either direction.
  { column: "availability_override_status", type: "text" },
  // Richer data extracted from the same GraphQL response we already fetch
  // for availability. Populated by the queue. Free signal — same call.
  { column: "price_display", type: "text" }, // "$541" / "$1,250" / null
  { column: "amenities", type: "text" }, // JSON array of curated AmenityTag strings
  { column: "cancellation_policy", type: "text" }, // "Strict" / "Flexible" / etc.
  { column: "unavailability_reason", type: "text" }, // "3 night minimum" etc.
];

// Per-table migrations: idempotent column additions for non-listings tables.
const COMMENT_MIGRATIONS: { column: string; type: string }[] = [
  { column: "parent_id", type: "text" },
];

const PLACE_MIGRATIONS: { column: string; type: string }[] = [
  // Optional street/postal address typed by the user when dropping a pin.
  // Free-text; not used for routing — just shown in the popup so the crew
  // knows what they're looking at without having to read raw lat/lng.
  { column: "address", type: "text" },
];

function ensureSchema(handle: Database.Database) {
  handle.pragma("journal_mode = WAL");
  handle.pragma("foreign_keys = ON");
  for (const stmt of SCHEMA_STATEMENTS) {
    handle.prepare(stmt).run();
  }
  const cols = handle
    .prepare("select name from pragma_table_info('listings')")
    .all() as { name: string }[];
  const existing = new Set(cols.map((c) => c.name));
  for (const { column, type } of MIGRATIONS) {
    if (!existing.has(column)) {
      handle.prepare(`alter table listings add column ${column} ${type}`).run();
    }
  }
  const commentCols = handle
    .prepare("select name from pragma_table_info('comments')")
    .all() as { name: string }[];
  const existingComment = new Set(commentCols.map((c) => c.name));
  for (const { column, type } of COMMENT_MIGRATIONS) {
    if (!existingComment.has(column)) {
      handle.prepare(`alter table comments add column ${column} ${type}`).run();
    }
  }
  const placeCols = handle
    .prepare("select name from pragma_table_info('places')")
    .all() as { name: string }[];
  const existingPlace = new Set(placeCols.map((c) => c.name));
  for (const { column, type } of PLACE_MIGRATIONS) {
    if (!existingPlace.has(column)) {
      handle.prepare(`alter table places add column ${column} ${type}`).run();
    }
  }

  // Migration (2026-05): votes table moved from ±1 thumb to 1-5 scale.
  // SQLite can't ALTER a CHECK constraint in place, so we re-create the table.
  // Old +1 votes → 5 (love), old -1 votes → 1 (nope). Approximates the
  // submitter's original sentiment in the new range. One-shot per DB.
  const votesSchema = handle
    .prepare("select sql from sqlite_master where type='table' and name='votes'")
    .get() as { sql: string } | undefined;
  if (votesSchema && votesSchema.sql.includes("value in (-1, 1)")) {
    handle.transaction(() => {
      handle
        .prepare(
          `create table votes_new (
             listing_id text not null references listings(id) on delete cascade,
             voter_id text not null,
             voter_name text not null,
             value integer not null check (value between 1 and 5),
             created_at text not null default (datetime('now')),
             primary key (listing_id, voter_id)
           )`,
        )
        .run();
      handle
        .prepare(
          `insert into votes_new (listing_id, voter_id, voter_name, value, created_at)
           select listing_id, voter_id, voter_name,
                  case when value = 1 then 5 else 1 end,
                  created_at
             from votes`,
        )
        .run();
      handle.prepare("drop table votes").run();
      handle.prepare("alter table votes_new rename to votes").run();
      handle
        .prepare("create index if not exists votes_listing_idx on votes(listing_id)")
        .run();
    })();
  }

  // One-time data cleanup (2030-08-02): the old availability auto-check
  // measured the wrong property and was wrong ~15% of the time. Wipe any
  // pre-existing auto-check verdicts so they don't keep showing stale
  // misleading "available" / "booked" badges. Organizer overrides
  // (availability_override_status) are preserved — those are user-verified.
  // Setting `settings.availability_reset_v1` once it runs makes this a
  // one-shot, not every-boot.
  const flag = handle
    .prepare("select value from settings where key = 'availability_reset_v1'")
    .get() as { value: string } | undefined;
  if (!flag) {
    handle
      .prepare(
        `update listings
            set availability_status = null,
                availability_dates_key = null,
                availability_checked_at = null
          where availability_override_status is null`,
      )
      .run();
    handle
      .prepare(
        "insert or replace into settings (key, value) values ('availability_reset_v1', ?)",
      )
      .run(new Date().toISOString());
  }
}

function open(): Database.Database {
  const handle = new Database(DB_FILE);
  ensureSchema(handle);
  return handle;
}

// Reuse the cached handle across hot-reloads, but always re-run the
// idempotent schema setup so newly-added tables/columns from a code change
// land without forcing a server restart.
export const db: Database.Database = globalThis.__quickie_db ?? open();
if (!globalThis.__quickie_db) globalThis.__quickie_db = db;
else ensureSchema(db);

export function newId(): string {
  return crypto.randomUUID();
}
