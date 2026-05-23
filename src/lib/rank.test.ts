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
    upvotes: 0,
    downvotes: 0,
    score: 0,
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
    const sparse = listing("sparse", { upvotes: 1, downvotes: 0, score: 1 });
    const popular = listing("popular", { upvotes: 5, downvotes: 3, score: 2 });
    expect(rankListings([sparse, popular], "votes").map((l) => l.id)).toEqual([
      "popular",
      "sparse",
    ]);
  });

  it('"score" prefers higher score', () => {
    const a = listing("a", { score: 1 });
    const b = listing("b", { score: 5 });
    expect(rankListings([a, b], "score").map((l) => l.id)).toEqual(["b", "a"]);
  });

  it('"score" gives a brief recency boost to brand-new listings', () => {
    // An old listing with score 1 should rank below a 0-score listing
    // created in the last few minutes, because the recency boost > 1.
    const dayOld = listing("old", {
      score: 1,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    const fresh = listing("fresh", {
      score: 0,
      created_at: new Date().toISOString(),
    });
    expect(rankListings([dayOld, fresh], "score").map((l) => l.id)).toEqual([
      "fresh",
      "old",
    ]);
  });

  it("returns a new array (does not mutate input)", () => {
    const a = listing("a", { score: 1 });
    const b = listing("b", { score: 2 });
    const input = [a, b];
    const sorted = rankListings(input, "score" as SortMode);
    expect(input).toEqual([a, b]);
    expect(sorted).not.toBe(input);
  });
});
