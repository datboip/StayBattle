#!/usr/bin/env node
/**
 * Build a *demo* SQLite database for screenshot captures.
 *
 *   - Real listing data (same Airbnb links, same scraped photos +
 *     amenities) is copied from the live DB at data/quickie.db
 *   - Social layer (voters, votes, comments, battle name, invite code)
 *     is REPLACED with safe fake data so the public README doesn't
 *     leak real names or invite codes
 *   - Output lives at data-demo/quickie.db, used by a second dev
 *     server: STAYBATTLE_DB_DIR=./data-demo PORT=3001 npm run dev
 *
 * Run:
 *   node scripts/screenshots/seed-demo.mjs
 */
import Database from "better-sqlite3";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const REAL_DB = join(ROOT, "data", "quickie.db");
const DEMO_DIR = join(ROOT, "data-demo");
const DEMO_DB = join(DEMO_DIR, "quickie.db");

// ─── Fake demo cast ───────────────────────────────────────────────
function isoDay(date) {
  return date.toISOString().slice(0, 10);
}
// Trip is always ~30 days out, lasts a week. Recompute every seed run so
// the demo looks like an upcoming trip forever, no matter what year it is.
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
  { name: "Sam",   pin: "2222" },
  { name: "Jordan", pin: "3333" },
  { name: "Riley", pin: "4444" },
  { name: "Casey", pin: "5555" },
  { name: "Morgan", pin: "6666" },
  { name: "Drew",  pin: "7777" },
  { name: "Quinn", pin: "8888" },
];

// Voice-y demo comments to make the screenshots feel like a real
// crew using it. Tagged by author name so the seeder picks the
// matching voter id.
const DEMO_COMMENTS = [
  { author: "Sam",   text: "Pool's right there, this is the move" },
  { author: "Riley", text: "10 min to Disney, no traffic stories from this one. Done." },
  { author: "Jordan", text: "Game room is huge but the kitchen looks tiny" },
  { author: "Morgan", text: "$1000/night is steep for a 7-day trip. We thinking?" },
  { author: "Casey", text: "I called the host, said no events. Bummer." },
  { author: "Drew",  text: "Hot tub + bbq + close to grocery store = my pick" },
  { author: "Quinn", text: "Better photos than the last one, but no AC??" },
  { author: "Sam",   text: "Lakefront views go hard. Worth the drive imo." },
  { author: "Alex",  text: "I've stayed here before. Beds are firm but everything else slaps." },
];

// scrypt hash matching the app's auth helper. Same N=16384, r=8, p=1
// settings + a per-user random salt encoded "salt:hash" in hex.
function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pin), salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

// Build a name_key the way the app does (lowercased, no spaces) so
// the unique constraint is consistent.
function nameKey(name) {
  return name.toLowerCase().trim();
}

// ─── Set up demo DB ──────────────────────────────────────────────
mkdirSync(DEMO_DIR, { recursive: true });
if (existsSync(DEMO_DB)) {
  // Start fresh so re-running is idempotent.
  rmSync(DEMO_DB, { force: true });
  rmSync(DEMO_DB + "-wal", { force: true });
  rmSync(DEMO_DB + "-shm", { force: true });
}
// Bootstrap by `.backup`-ing the live DB via the sqlite3 CLI — this
// gives us a checkpointed clean copy (one .db file, no WAL/SHM
// dependency) with the exact schema + all listings. Plain
// copyFileSync loses any rows still in the WAL.
console.log("Cloning live DB → demo DB via sqlite3 .backup…");
execFileSync("sqlite3", [REAL_DB, `.backup '${DEMO_DB}'`], { stdio: "inherit" });
const db = new Database(DEMO_DB);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Wipe the social layer; keep listings + places.
console.log("Wiping social tables…");
for (const t of ["comments", "votes", "voters", "settings", "past_battles", "participants"]) {
  try {
    db.prepare(`delete from ${t}`).run();
  } catch {
    // Table may not exist on older schemas; ignore.
  }
}

// Insert demo voters with hashed PINs so PIN sign-in *would* work
// if anyone in the README typed them in (cute but not required —
// screenshots inject voter into localStorage and skip the form).
console.log("Inserting demo voters…");
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

// Insert the demo battle.
console.log("Inserting demo battle…");
DEMO_BATTLE.organizer_id = voterIds["Alex"];
db.prepare(
  `insert into settings (key, value) values ('battle', ?)`,
).run(JSON.stringify({
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
}));
db.prepare(
  `insert into settings (key, value) values ('trip_check_in', ?)`,
).run(DEMO_BATTLE.check_in);
db.prepare(
  `insert into settings (key, value) values ('trip_check_out', ?)`,
).run(DEMO_BATTLE.check_out);

// All demo voters are participants in this battle.
console.log("Inserting participants…");
const insertPart = db.prepare(
  `insert into participants (battle_id, voter_id, voter_name, joined_at)
   values (?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
);
Object.entries(voterIds).forEach(([name, id], i) => {
  try {
    insertPart.run(DEMO_BATTLE.id, id, name, 24 - i * 2);
  } catch (e) {
    console.warn(`  participant insert failed for ${name}:`, e.message);
  }
});

// Re-attribute each listing's "added by" to a demo voter, randomly.
console.log("Reassigning listing authors…");
const listings = db.prepare("select id from listings").all();
const updateListingAuthor = db.prepare(
  "update listings set added_by_id = ?, added_by_name = ? where id = ?",
);
const voterEntries = Object.entries(voterIds);
listings.forEach((row, i) => {
  const [name, id] = voterEntries[i % voterEntries.length];
  updateListingAuthor.run(id, name, row.id);
});

// Pre-bake availability statuses so the demo never has to call Airbnb's
// GraphQL endpoint (which is rate-limited and may be blocked from VPS).
// Mix of available/unavailable/unknown so the badge variety shows up
// in screenshots. dates_key matches the current trip so the app's cache
// validator considers them fresh.
console.log("Pre-baking availability statuses…");
const datesKey = `${DEMO_BATTLE.check_in}_${DEMO_BATTLE.check_out}`;
const updateAvail = db.prepare(
  `update listings set
     availability_status = ?,
     availability_dates_key = ?,
     availability_checked_at = datetime('now'),
     unavailability_reason = ?
   where id = ?`,
);
listings.forEach((row, i) => {
  // 70% available, 20% unavailable, 10% unknown — gives the badge variety
  const m = i % 10;
  if (m < 7) {
    updateAvail.run("available", datesKey, null, row.id);
  } else if (m < 9) {
    updateAvail.run("unavailable", datesKey, "Not available for these dates", row.id);
  } else {
    updateAvail.run("unknown", datesKey, null, row.id);
  }
});

// Spread votes across listings so the ranking screenshot has variety.
console.log("Inserting votes…");
const insertVote = db.prepare(
  `insert into votes (listing_id, voter_id, voter_name, value, created_at)
   values (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
);
// 1–5 ratings, fanned out so the ranking screenshot shows a real gradient.
// Top of the catalog hovers near 4–5 (Like/Love), middle around 3 (OK),
// bottom 1–2 (Nope/Meh). Sprinkle one off-trend rating per listing so
// every card has at least one dissenting voter — keeps tiles realistic.
const RATING_BANDS = [
  [5, 5, 4, 5, 4, 4],   // top: mostly Love + Like
  [4, 4, 3, 5, 4, 3],   // upper-mid: solid
  [3, 4, 3, 3, 2, 4],   // middle: meh-to-ok
  [2, 3, 2, 1, 3, 2],   // lower: nope-leaning
  [1, 2, 1, 2, 1, 3],   // bottom: graveyard
];
// Re-read the listing rows including their re-assigned added_by_id so we
// can skip self-votes (server rejects them too — see actions.ts).
const listingsWithOwner = db
  .prepare("select id, added_by_id from listings")
  .all();
listingsWithOwner.forEach((listing, i) => {
  const bandIdx = Math.min(
    RATING_BANDS.length - 1,
    Math.floor((i / Math.max(listingsWithOwner.length, 1)) * RATING_BANDS.length),
  );
  const band = RATING_BANDS[bandIdx];
  const n = 3 + (i % 5); // 3–7 voters per listing
  for (let k = 0; k < n; k++) {
    const [name, id] = voterEntries[(i + k) % voterEntries.length];
    if (id === listing.added_by_id) continue; // submitters can't rate their own
    const value = band[(i + k) % band.length];
    try {
      insertVote.run(listing.id, id, name, value, 18 - k);
    } catch {} // duplicate (voter, listing) unique constraint may bite — fine
  }
});

// Plant some demo comments on the top listings so the discussion
// threads have content in the screenshot.
console.log("Inserting comments…");
const insertComment = db.prepare(
  `insert into comments (id, listing_id, voter_id, voter_name, body, parent_id, created_at)
   values (?, ?, ?, ?, ?, null, datetime('now', '-' || ? || ' hours'))`,
);
listings.slice(0, DEMO_COMMENTS.length).forEach((listing, i) => {
  const c = DEMO_COMMENTS[i];
  insertComment.run(
    randomUUID(),
    listing.id,
    voterIds[c.author],
    c.author,
    c.text,
    12 - i,
  );
});

// Add some recognisable Orlando reference points so the map shot
// shows BOTH listings (blue pins) and reference places (orange dots).
// The real DB already had SeaWorld + Silver Lake; these supplement
// with theme parks people instantly recognise.
console.log("Inserting reference places…");
const refPlaces = [
  { name: "Gatorland",                   lat: 28.3766, lon: -81.3993, by: "Alex"   },
  { name: "Lake Eola Park",              lat: 28.5436, lon: -81.3711, by: "Sam"    },
  { name: "ICON Park",                   lat: 28.4435, lon: -81.4684, by: "Riley"  },
  { name: "Harry P. Leu Gardens",        lat: 28.5614, lon: -81.3608, by: "Jordan" },
  { name: "Orlando Science Center",      lat: 28.5713, lon: -81.3680, by: "Casey"  },
];
const insertPlace = db.prepare(
  `insert or ignore into places (id, name, latitude, longitude, kind, added_by_name, created_at)
   values (?, ?, ?, ?, 'reference', ?, datetime('now', '-' || ? || ' hours'))`,
);
refPlaces.forEach((p, i) => insertPlace.run(randomUUID(), p.name, p.lat, p.lon, p.by, 20 - i));

// Plant a handful of closed past battles so the trophy case looks
// "lived in" — three trips' worth of podiums, not just one sad row.
console.log("Inserting past battles for trophy case…");
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
  // Pick 3 different listings as the podium, rotating through the catalog.
  const three = [0, 1, 2].map((k) => allListings[(offset + k) % allListings.length]);
  // Synthetic podium for past-battle cards: gold ≈ 4.8, silver ≈ 4.3,
  // bronze ≈ 3.7 with a believable raters spread. Matches the live
  // archive shape from past-battles-server.ts.
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
    url: l.url,
    score: tierStats[i].score,
    vote_count: tierStats[i].vote_count,
    added_by_name: voterEntries[i % voterEntries.length][0],
    tier: i + 1,
  }));
}
const pastBattles = [
  {
    name: "Lakehouse Long Weekend",
    check_in: "2030-03-15", check_out: "2030-03-21",
    organizer: "Alex",
    participants: ["Alex", "Sam", "Jordan", "Riley", "Casey"],
    listings: 18, votes: 47, comments: 12,
    closed_days_ago: -30, created_days_ago: -45,
    offset: 0,
  },
  {
    name: "Cabin Crew · Spring '29",
    check_in: "2029-05-08", check_out: "2029-05-12",
    organizer: "Sam",
    participants: ["Sam", "Jordan", "Casey", "Morgan"],
    listings: 12, votes: 31, comments: 9,
    closed_days_ago: -210, created_days_ago: -225,
    offset: 3,
  },
  {
    name: "NYE '28 House Hunt",
    check_in: "2028-12-29", check_out: "2029-01-02",
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

db.close();
console.log("");
console.log(`✓ Demo DB ready: ${DEMO_DB}`);
console.log("");
console.log("Spin up the demo server in a separate terminal:");
console.log("  STAYBATTLE_DB_DIR=./data-demo PORT=3001 npm run dev");
console.log("");
console.log("Then capture:");
console.log("  BASE_URL=http://localhost:3001 DEMO_VOTER_ID=" +
  voterIds["Alex"] + " DEMO_VOTER_NAME=Alex node scripts/screenshots/capture.mjs");
