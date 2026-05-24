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
const DEMO_BATTLE = {
  id: randomUUID(),
  name: "Crew Beach Week",
  organizer_name: "Alex",
  invite_code: "DEMO99",
  check_in: "2030-08-25",
  check_out: "2030-09-01",
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

// Spread votes across listings so the ranking screenshot has variety.
console.log("Inserting votes…");
const insertVote = db.prepare(
  `insert into votes (listing_id, voter_id, voter_name, value, created_at)
   values (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
);
listings.forEach((listing, i) => {
  // 3-7 votes per listing, mostly positive with the occasional downvote
  const n = 3 + (i % 5);
  for (let k = 0; k < n; k++) {
    const [name, id] = voterEntries[(i + k) % voterEntries.length];
    // Top listings get more upvotes, bottom listings more downvotes
    const value = i < listings.length * 0.7 ? (k === 0 && i % 6 === 0 ? -1 : 1) : (k === 0 ? 1 : -1);
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

// Plant ONE closed past battle so the trophy-case screenshot has
// something to show.
console.log("Inserting one past battle for trophy case…");
const top3 = db.prepare(
  "select id, title, image_url, url, location from listings limit 3",
).all();
db.prepare(
  `insert into past_battles
    (id, name, check_in, check_out, organizer_name, participant_names,
     podium, total_listings, total_votes, total_comments, closed_at, created_at)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','-30 days'), datetime('now','-45 days'))`,
).run(
  randomUUID(),
  "Lakehouse Long Weekend",
  "2030-03-15",
  "2030-03-21",
  "Alex",
  JSON.stringify(["Alex", "Sam", "Jordan", "Riley", "Casey"]),
  JSON.stringify(
    top3.map((l, i) => ({
      title: l.title ?? `Cabin ${i + 1}`,
      short_title: (l.title ?? `Cabin ${i + 1}`).slice(0, 40),
      location: l.location,
      image_url: l.image_url,
      url: l.url,
      score: 9 - i * 2,
      upvotes: 9 - i * 2,
      downvotes: 0,
      added_by_name: voterEntries[i % voterEntries.length][0],
      tier: (i + 1),
    })),
  ),
  18,
  47,
  12,
);

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
