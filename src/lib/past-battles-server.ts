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
              coalesce(sum(case when v.value = 1 then 1 else 0 end), 0) as upvotes,
              coalesce(sum(case when v.value = -1 then 1 else 0 end), 0) as downvotes
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
    upvotes: number;
    downvotes: number;
  }>;

  const ranked = listings
    .map((l) => ({
      ...l,
      score: l.upvotes - l.downvotes,
    }))
    // Primary: net score desc. Tiebreaker: total engagement (upvotes+downvotes)
    // desc — listings nobody bothered to weigh in on shouldn't outrank ones
    // that everyone voted on, when net score is otherwise equal. Final
    // tiebreaker: stable alphabetical by title so the snapshot is deterministic.
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aE = a.upvotes + a.downvotes;
      const bE = b.upvotes + b.downvotes;
      if (bE !== aE) return bE - aE;
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
      upvotes: l.upvotes,
      downvotes: l.downvotes,
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
    battle.check_in,
    battle.check_out,
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
