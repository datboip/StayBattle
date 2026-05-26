import { describe, expect, it } from "vitest";
import { rankListings, type SortMode } from "./rank";
import type { ListingWithStats } from "./types";

function listing(
  id: string,
  partial: Partial<ListingWithStats> = {},
): ListingWithStats {
  const now = Date.now();
  return {
    id,
    url: `https://www.airbnb.com/rooms/${id}`,
    airbnb_id: id,
    title: `Listing ${id}`,
    image_url: null,
    photos: [],
    price_per_night: null,
    currency: null,
    location: null,
    latitude: null,
    longitude: null,
    bedrooms: null,
    bathrooms: null,
    beds: null,
    max_guests: null,
    rating: null,
    review_count: null,
    created_at: new Date(now).toISOString(),
    added_by_name: null,
    added_by_id: null,
    availability_status: null,
    availability_dates_key: null,
    availability_checked_at: null,
    availability_override: null,
    availability_override_by: null,
    availability_override_at: null,
    availability_override_status: null,
    price_display: null,
    amenities: [],
    cancellation_policy: null,
    unavailability_reason: null,
    votes: [],
    comments: [],
    vote_count: 0,
    score: null,
    ...partial,
  };
}

describe("rankListings", () => {
  it('"recent" sorts newest first', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const old = listing("old", { created_at: yesterday });
    const fresh = listing("fresh", { created_at: now });
    expect(rankListings([old, fresh], "recent").map((l) => l.id)).toEqual([
      "fresh",
      "old",
    ]);
  });

  it('"votes" sorts by total votes desc', () => {
    const sparse = listing("sparse", { vote_count: 1, score: 4 });
    const popular = listing("popular", { vote_count: 8, score: 3 });
    expect(rankListings([sparse, popular], "votes").map((l) => l.id)).toEqual([
      "popular",
      "sparse",
    ]);
  });

  it('"score" prefers higher mean rating', () => {
    const a = listing("a", { score: 2.5, vote_count: 3 });
    const b = listing("b", { score: 4.5, vote_count: 3 });
    expect(rankListings([a, b], "score").map((l) => l.id)).toEqual(["b", "a"]);
  });

  it('"score" ranks unrated listings below rated ones', () => {
    const rated = listing("rated", { score: 1.5, vote_count: 2 });
    const unrated = listing("unrated", { score: null, vote_count: 0 });
    expect(rankListings([rated, unrated], "score").map((l) => l.id)).toEqual([
      "rated",
      "unrated",
    ]);
  });

  it("returns a new array (does not mutate input)", () => {
    const a = listing("a", { score: 2.5 });
    const b = listing("b", { score: 4 });
    const input = [a, b];
    const sorted = rankListings(input, "score" as SortMode);
    expect(input).toEqual([a, b]);
    expect(sorted).not.toBe(input);
  });
});
