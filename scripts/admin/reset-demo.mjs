#!/usr/bin/env node
/**
 * Nightly demo reset.
 *
 * Wipes the social layer (voters, votes, comments, participants,
 * settings, past_battles, places) on the LIVE production DB and
 * re-seeds the demo crew + battle. Listings are KEPT — they're the
 * Airbnb URLs the demo browses, not user data.
 *
 * Designed to run from a systemd timer on the VPS. Source of truth
 * for the demo cast / battle / comments lives here AND in
 * scripts/screenshots/seed-demo.mjs. The two are intentionally not
 * sharing code: this script runs in production, that one runs against
 * a copy of the dev DB for screenshot captures, and the boundaries
 * stay clean if each stays self-contained.
 *
 * Run manually:
 *   STAYBATTLE_DB_DIR=/var/lib/staybattle node scripts/admin/reset-demo.mjs
 *
 * The systemd unit at infra/staybattle-demo-reset.{service,timer} fires
 * this daily at 04:00 UTC.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const DB_DIR = process.env.STAYBATTLE_DB_DIR ?? "/var/lib/staybattle";
const DB_PATH = join(DB_DIR, "quickie.db");

if (!existsSync(DB_PATH)) {
  console.error(`reset-demo: DB not found at ${DB_PATH}`);
  console.error("Set STAYBATTLE_DB_DIR if it lives somewhere else.");
  process.exit(2);
}

// ─── Demo cast (must match DemoModal.tsx + seed-demo.mjs) ───────────
function isoDay(date) {
  return date.toISOString().slice(0, 10);
}
const CHECK_IN = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const CHECK_OUT = new Date(Date.now() + 37 * 24 * 3600 * 1000);
const DEMO_BATTLE = {
  id: randomUUID(),
  name: "Crew Beach Week",
  organizer_name: "Alex",
  invite_code: "DEMO99",
  check_in: isoDay(CHECK_IN),
  check_out: isoDay(CHECK_OUT),
};
const DEMO_VOTERS = [
  { name: "Alex", pin: "1111", isOrg: true },
  { name: "Sam", pin: "2222" },
  { name: "Jordan", pin: "3333" },
  { name: "Riley", pin: "4444" },
  { name: "Casey", pin: "5555" },
  { name: "Morgan", pin: "6666" },
  { name: "Drew", pin: "7777" },
  { name: "Quinn", pin: "8888" },
];
const DEMO_COMMENTS = [
  { author: "Sam", text: "Pool's right there, this is the move" },
  { author: "Riley", text: "10 min to Disney, no traffic stories from this one. Done." },
  { author: "Jordan", text: "Game room is huge but the kitchen looks tiny" },
  { author: "Morgan", text: "$1000/night is steep for a 7-day trip. We thinking?" },
  { author: "Casey", text: "I called the host, said no events. Bummer." },
  { author: "Drew", text: "Hot tub + bbq + close to grocery store = my pick" },
  { author: "Quinn", text: "Better photos than the last one, but no AC??" },
  { author: "Sam", text: "Lakefront views go hard. Worth the drive imo." },
  { author: "Alex", text: "I've stayed here before. Beds are firm but everything else slaps." },
];
const RATING_BANDS = [
  [5, 5, 4, 5, 4, 4],
  [4, 4, 3, 5, 4, 3],
  [3, 4, 3, 3, 2, 4],
  [2, 3, 2, 1, 3, 2],
  [1, 2, 1, 2, 1, 3],
];
const REF_PLACES = [
  { name: "Magic Kingdom",               lat: 28.4177, lon: -81.5812, by: "Alex",   kind: "theme-park" },
  { name: "Gatorland",                   lat: 28.3766, lon: -81.3993, by: "Alex",   kind: "theme-park" },
  { name: "MCO · Orlando Int'l Airport", lat: 28.4312, lon: -81.3081, by: "Sam",    kind: "airport"    },
  { name: "Publix · Sand Lake",          lat: 28.4485, lon: -81.4794, by: "Morgan", kind: "grocery"    },
  { name: "Disney Springs",              lat: 28.3702, lon: -81.5189, by: "Riley",  kind: "shopping"   },
  { name: "Harry P. Leu Gardens",        lat: 28.5614, lon: -81.3608, by: "Jordan", kind: "nature"     },
  { name: "Hash House A Go Go",          lat: 28.4423, lon: -81.4707, by: "Drew",   kind: "restaurant" },
  { name: "ICEBAR Orlando",              lat: 28.4435, lon: -81.4684, by: "Quinn",  kind: "bar"        },
  { name: "Orlando Science Center",      lat: 28.5713, lon: -81.3680, by: "Casey",  kind: "museum"     },
  { name: "Cocoa Beach",                 lat: 28.3200, lon: -80.6076, by: "Sam",    kind: "beach"      },
];

function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pin), salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
function nameKey(name) {
  return name.toLowerCase().trim();
}

// ─── Reset ──────────────────────────────────────────────────────────
const startedAt = new Date().toISOString();
console.log(`reset-demo @ ${startedAt} · DB=${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const tx = db.transaction(() => {
  // Wipe the social layer (keep listings — they're the demo content).
  for (const t of [
    "comments", "votes", "voters", "settings",
    "past_battles", "participants", "places",
  ]) {
    try { db.prepare(`delete from ${t}`).run(); } catch {}
  }

  // Demo voters
  const voterIds = {};
  const insertVoter = db.prepare(
    `insert into voters (id, name, name_key, pin_hash, created_at)
     values (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
  );
  DEMO_VOTERS.forEach((v, i) => {
    const id = randomUUID();
    voterIds[v.name] = id;
    insertVoter.run(id, v.name, nameKey(v.name), hashPin(v.pin), 72 - i * 2);
  });

  // Demo battle in settings
  DEMO_BATTLE.organizer_id = voterIds["Alex"];
  db.prepare(`insert into settings (key, value) values ('battle', ?)`).run(
    JSON.stringify({
      id: DEMO_BATTLE.id,
      name: DEMO_BATTLE.name,
      organizer_id: DEMO_BATTLE.organizer_id,
      organizer_name: DEMO_BATTLE.organizer_name,
      phase: "voting",
      invite_code: DEMO_BATTLE.invite_code,
      check_in: DEMO_BATTLE.check_in,
      check_out: DEMO_BATTLE.check_out,
      submission_deadline: null,
      voting_started_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
      created_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
    }),
  );
  db.prepare(`insert into settings (key, value) values ('trip_check_in', ?)`).run(DEMO_BATTLE.check_in);
  db.prepare(`insert into settings (key, value) values ('trip_check_out', ?)`).run(DEMO_BATTLE.check_out);
  db.prepare(`insert into settings (key, value) values ('battle_requirements', ?)`).run(
    JSON.stringify(["wifi", "pool", "parking", "kitchen"]),
  );

  // Participants
  const insertPart = db.prepare(
    `insert into participants (battle_id, voter_id, voter_name, joined_at)
     values (?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
  );
  Object.entries(voterIds).forEach(([name, id], i) => {
    try { insertPart.run(DEMO_BATTLE.id, id, name, 24 - i * 2); } catch {}
  });

  // Re-attribute listings to demo voters
  const listings = db.prepare("select id from listings").all();
  const voterEntries = Object.entries(voterIds);
  const updListingAuthor = db.prepare(
    `update listings set added_by_id = ?, added_by_name = ? where id = ?`,
  );
  listings.forEach((row, i) => {
    const [name, id] = voterEntries[i % voterEntries.length];
    updListingAuthor.run(id, name, row.id);
  });

  // Pre-bake availability (no GraphQL call needed in demo mode)
  const datesKey = `${DEMO_BATTLE.check_in}_${DEMO_BATTLE.check_out}`;
  const updAvail = db.prepare(
    `update listings set
       availability_status = ?,
       availability_dates_key = ?,
       availability_checked_at = datetime('now'),
       unavailability_reason = ?
     where id = ?`,
  );
  listings.forEach((row, i) => {
    const m = i % 10;
    if (m < 7) updAvail.run("available", datesKey, null, row.id);
    else if (m < 9) updAvail.run("unavailable", datesKey, "Not available for these dates", row.id);
    else updAvail.run("unknown", datesKey, null, row.id);
  });

  // Votes — banded so the ranking has gradient, skip self-votes
  const insertVote = db.prepare(
    `insert into votes (listing_id, voter_id, voter_name, value, created_at)
     values (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
  );
  const listingsWithOwner = db.prepare("select id, added_by_id from listings").all();
  listingsWithOwner.forEach((listing, i) => {
    const bandIdx = Math.min(
      RATING_BANDS.length - 1,
      Math.floor((i / Math.max(listingsWithOwner.length, 1)) * RATING_BANDS.length),
    );
    const band = RATING_BANDS[bandIdx];
    const n = 3 + (i % 5);
    for (let k = 0; k < n; k++) {
      const [name, id] = voterEntries[(i + k) % voterEntries.length];
      if (id === listing.added_by_id) continue;
      const value = band[(i + k) % band.length];
      try { insertVote.run(listing.id, id, name, value, 18 - k); } catch {}
    }
  });

  // Comments on the top listings
  const insertComment = db.prepare(
    `insert into comments (id, listing_id, voter_id, voter_name, body, parent_id, created_at)
     values (?, ?, ?, ?, ?, null, datetime('now', '-' || ? || ' hours'))`,
  );
  listings.slice(0, DEMO_COMMENTS.length).forEach((listing, i) => {
    const c = DEMO_COMMENTS[i];
    insertComment.run(randomUUID(), listing.id, voterIds[c.author], c.author, c.text, 12 - i);
  });

  // Reference places — categorized
  const insertPlace = db.prepare(
    `insert or ignore into places (id, name, latitude, longitude, kind, added_by_name, created_at)
     values (?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
  );
  REF_PLACES.forEach((p, i) =>
    insertPlace.run(randomUUID(), p.name, p.lat, p.lon, p.kind, p.by, 20 - i),
  );

  // Past battles for the trophy case
  const allListings = db.prepare(
    "select id, title, image_url, url, location from listings",
  ).all();
  const insertPast = db.prepare(
    `insert into past_battles
       (id, name, check_in, check_out, organizer_name, participant_names,
        podium, total_listings, total_votes, total_comments, closed_at, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))`,
  );
  function podiumFrom(offset) {
    const three = [0, 1, 2].map((k) => allListings[(offset + k) % allListings.length]);
    const tierStats = [
      { score: 4.8, vote_count: 6 },
      { score: 4.3, vote_count: 5 },
      { score: 3.7, vote_count: 4 },
    ];
    return three.map((l, i) => ({
      title: l.title ?? `Cabin ${i + 1}`,
      short_title: (l.title ?? `Cabin ${i + 1}`).slice(0, 40),
      location: l.location,
      image_url: l.image_url,
      url: "",
      score: tierStats[i].score,
      vote_count: tierStats[i].vote_count,
      added_by_name: voterEntries[i % voterEntries.length][0],
      tier: i + 1,
    }));
  }
  // Note: these are stored as YYYY-MM-01 (month-rounded) on purpose —
  // archiveCurrentBattle in past-battles-server.ts scrubs day-level
  // detail at archive time. The trophy case UI displays only month/year
  // anyway, so matching that format here keeps the data shape consistent
  // with a real archive snapshot. Earlier the values were same-day
  // YYYY-MM-01 to YYYY-MM-01 — readable as "zero-length trip" in any
  // downstream code; fixed to span sensible month ranges.
  const pastBattles = [
    {
      name: "Lakehouse Long Weekend",
      check_in: "2030-03-01", check_out: "2030-04-01",
      organizer: "Alex",
      participants: ["Alex", "Sam", "Jordan", "Riley", "Casey"],
      listings: 18, votes: 47, comments: 12,
      closed_days_ago: -30, created_days_ago: -45,
      offset: 0,
    },
    {
      name: "Cabin Crew · Spring '29",
      check_in: "2029-05-01", check_out: "2029-06-01",
      organizer: "Sam",
      participants: ["Sam", "Jordan", "Casey", "Morgan"],
      listings: 12, votes: 31, comments: 9,
      closed_days_ago: -210, created_days_ago: -225,
      offset: 3,
    },
    {
      name: "NYE '28 House Hunt",
      check_in: "2028-12-01", check_out: "2029-01-01",
      organizer: "Riley",
      participants: ["Riley", "Alex", "Drew", "Quinn", "Sam", "Casey"],
      listings: 22, votes: 64, comments: 18,
      closed_days_ago: -420, created_days_ago: -440,
      offset: 6,
    },
  ];
  pastBattles.forEach((b) => {
    insertPast.run(
      randomUUID(),
      b.name, b.check_in, b.check_out, b.organizer,
      JSON.stringify(b.participants),
      JSON.stringify(podiumFrom(b.offset)),
      b.listings, b.votes, b.comments,
      `${b.closed_days_ago} days`, `${b.created_days_ago} days`,
    );
  });
});

tx();
db.close();

const counts = {
  voters: DEMO_VOTERS.length,
  comments: DEMO_COMMENTS.length,
  places: REF_PLACES.length,
};
console.log(
  `reset-demo @ ${new Date().toISOString()} · OK · ` +
    `voters=${counts.voters} comments=${counts.comments} places=${counts.places}`,
);
