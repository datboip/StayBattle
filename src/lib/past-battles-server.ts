import "server-only";
import { db } from "./db";
import type { PastBattle, PodiumEntry } from "./types";
import { shortTitle } from "./title";

type Row = {
  id: string;
  name: string;
  check_in: string | null;
  check_out: string | null;
  organizer_name: string | null;
  participant_names: string;
  podium: string;
  total_listings: number;
  total_votes: number;
  total_comments: number;
  closed_at: string;
  created_at: string;
};

/**
 * Round an ISO date string to the first of its month — "2026-06-26" →
 * "2026-06-01". Used at archive time to scrub day-level trip dates from
 * the long-lived past_battles snapshot (see archiveCurrentBattle). The
 * trophy-case UI already displays only month/year; this just ensures the
 * raw stored value matches what's shown so a view-source doesn't recover
 * the exact trip window.
 */
function monthSnapshot(iso: string | null): string | null {
  if (!iso) return null;
  // Accept full ISO timestamps and YYYY-MM-DD alike — slice covers both.
  const ymd = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return iso; // bail rather than mangle weird input
  return `${ymd.slice(0, 7)}-01`;
}

function rowToPast(row: Row): PastBattle {
  let participants: string[] = [];
  let podium: PodiumEntry[] = [];
  try {
    participants = JSON.parse(row.participant_names);
  } catch {}
  try {
    podium = JSON.parse(row.podium);
  } catch {}
  return {
    id: row.id,
    name: row.name,
    check_in: row.check_in,
    check_out: row.check_out,
    organizer_name: row.organizer_name,
    participant_names: Array.isArray(participants) ? participants : [],
    podium: Array.isArray(podium) ? podium : [],
    total_listings: row.total_listings,
    total_votes: row.total_votes,
    total_comments: row.total_comments,
    closed_at: row.closed_at,
    created_at: row.created_at,
  };
}

export function listPastBattles(): PastBattle[] {
  const rows = db
    .prepare("select * from past_battles order by closed_at desc")
    .all() as Row[];
  return rows.map(rowToPast);
}

/**
 * Snapshot the current battle into past_battles, computing the podium from
 * the highest-scored listings.
 */
export function archiveCurrentBattle(battle: {
  id: string;
  name: string;
  check_in: string | null;
  check_out: string | null;
  organizer_name: string;
  created_at: string;
}): PastBattle {
  // Pull listings + their vote counts to find the podium. Exclude listings
  // flagged as unavailable for the trip dates — the trophy goes to something
  // the crew could actually book, not a sentimental favorite that's booked
  // up. Listings with status "unknown" or null still qualify because we
  // can't be 100% sure they're unavailable.
  const listings = db
    .prepare(
      `select l.id, l.title, l.location, l.image_url, l.url, l.added_by_name,
              coalesce(avg(v.value), 0) as score,
              coalesce(count(v.value), 0) as vote_count
         from listings l
         left join votes v on v.listing_id = l.id
        where coalesce(l.availability_status, 'unknown') != 'unavailable'
           or l.availability_override is not null
        group by l.id`,
    )
    .all() as Array<{
    id: string;
    title: string | null;
    location: string | null;
    image_url: string | null;
    url: string;
    added_by_name: string | null;
    score: number;
    vote_count: number;
  }>;

  // Only include listings with at least one vote on the podium — a 0-vote
  // listing has no mean to rank by. Primary sort: mean rating desc.
  // Tiebreaker: more raters wins (we trust a 4.5 from 8 people over a 4.5
  // from 1). Final tiebreaker: alphabetical for determinism.
  const ranked = listings
    .filter((l) => l.vote_count > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
      return (a.title ?? "").localeCompare(b.title ?? "");
    });

  // Group into tiers of equal score so true ties become shared medals.
  // Walk through ranked listings, opening a new tier whenever the score drops.
  // Stop after 3 tiers (gold/silver/bronze) AND cap total entries at ~12 in
  // case half the roster tied at +0.
  const MAX_TIERS = 3;
  const MAX_ENTRIES = 12;
  const podium: PodiumEntry[] = [];
  let currentScore: number | null = null;
  let currentTier: 1 | 2 | 3 = 1;
  for (const l of ranked) {
    if (currentScore !== null && l.score !== currentScore) {
      if (currentTier >= MAX_TIERS) break;
      currentTier = (currentTier + 1) as 1 | 2 | 3;
    }
    if (podium.length >= MAX_ENTRIES) break;
    currentScore = l.score;
    podium.push({
      title: l.title,
      short_title: shortTitle(l.title) || null,
      location: l.location,
      image_url: l.image_url,
      url: l.url,
      score: l.score,
      vote_count: l.vote_count,
      added_by_name: l.added_by_name,
      tier: currentTier,
    });
  }

  const totals = db
    .prepare(
      `select
         (select count(*) from listings) as total_listings,
         (select count(*) from votes)    as total_votes,
         (select count(*) from comments) as total_comments`,
    )
    .get() as {
    total_listings: number;
    total_votes: number;
    total_comments: number;
  };

  const participantRows = db
    .prepare("select voter_name from participants where battle_id = ?")
    .all(battle.id) as { voter_name: string }[];
  const participantNames = participantRows.map((p) => p.voter_name);

  // Scrub exact dates → YYYY-MM-01 on archive so the long-lived trophy
  // case doesn't preserve "the house was empty 2026-06-26 through
  // 2026-07-03." TrophyCase already DISPLAYS only month/year, but the
  // raw ISO strings used to sit in past_battles.* — anyone view-sourcing
  // the page (or pulling the JSON later) recovered them. Privacy audit
  // 2026-05-27. The month-level snapshot keeps "we went in March 2030"
  // intact for the "remember the trip" intent and drops the day-level
  // detail used in the trip-window doxxing threat.
  const checkInArchived = monthSnapshot(battle.check_in);
  const checkOutArchived = monthSnapshot(battle.check_out);

  db.prepare(
    `insert into past_battles (
        id, name, check_in, check_out, organizer_name,
        participant_names, podium,
        total_listings, total_votes, total_comments,
        created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    battle.id,
    battle.name,
    checkInArchived,
    checkOutArchived,
    battle.organizer_name,
    JSON.stringify(participantNames),
    JSON.stringify(podium),
    totals.total_listings,
    totals.total_votes,
    totals.total_comments,
    battle.created_at,
  );

  return listPastBattles()[0];
}

export function deletePastBattle(id: string): void {
  db.prepare("delete from past_battles where id = ?").run(id);
}
