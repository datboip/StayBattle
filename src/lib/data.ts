import { db } from "./db";
import type { Comment, Listing, ListingWithStats, Place, Vote } from "./types";

type ListingRow = Omit<Listing, "photos" | "amenities"> & {
  photos: string;
  amenities: string | null;
};

export function fetchAllPlaces(): Place[] {
  return db
    .prepare("select * from places order by created_at asc")
    .all() as Place[];
}

export function fetchAllListings(): ListingWithStats[] {
  const listings = db
    .prepare("select * from listings order by created_at desc")
    .all() as ListingRow[];

  const votes = db.prepare("select * from votes").all() as Vote[];
  const comments = db
    .prepare("select * from comments order by created_at asc")
    .all() as Comment[];

  const votesByListing = new Map<string, Vote[]>();
  for (const v of votes) {
    const arr = votesByListing.get(v.listing_id) ?? [];
    arr.push(v);
    votesByListing.set(v.listing_id, arr);
  }

  const commentsByListing = new Map<string, Comment[]>();
  for (const c of comments) {
    const arr = commentsByListing.get(c.listing_id) ?? [];
    arr.push(c);
    commentsByListing.set(c.listing_id, arr);
  }

  return listings.map((row) => {
    const vs = votesByListing.get(row.id) ?? [];
    const vote_count = vs.length;
    // Mean of 1–5 ratings. `null` when no one has voted so the UI can show
    // "not yet rated" instead of an arbitrary "0" that misranks listings.
    const score = vote_count > 0
      ? vs.reduce((sum, v) => sum + v.value, 0) / vote_count
      : null;
    let photos: string[] = [];
    try {
      photos = JSON.parse(row.photos);
      if (!Array.isArray(photos)) photos = [];
    } catch {}
    let amenities: string[] = [];
    if (row.amenities) {
      try {
        const parsed = JSON.parse(row.amenities);
        if (Array.isArray(parsed)) amenities = parsed.filter((x) => typeof x === "string");
      } catch {}
    }
    return {
      ...row,
      photos,
      amenities,
      votes: vs,
      comments: commentsByListing.get(row.id) ?? [],
      vote_count,
      score,
    } satisfies ListingWithStats;
  });
}
