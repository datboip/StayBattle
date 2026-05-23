export type AvailabilityStatus = "available" | "unavailable" | "unknown";

export type Listing = {
  id: string;
  url: string;
  airbnb_id: string | null;
  title: string | null;
  image_url: string | null;
  photos: string[];
  price_per_night: number | null;
  currency: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  max_guests: number | null;
  rating: number | null;
  review_count: number | null;
  created_at: string;
  added_by_name: string | null;
  added_by_id: string | null;
  availability_status: AvailabilityStatus | null;
  availability_dates_key: string | null;
  availability_checked_at: string | null;
  availability_override: string | null;
  availability_override_by: string | null;
  availability_override_at: string | null;
  availability_override_status: AvailabilityStatus | null;
  // Richer data sourced from the same Airbnb GraphQL call as availability.
  // `amenities` is a string[] of curated tags from AMENITY_TAGS (see
  // airbnb-graphql.ts) — stored in the DB as JSON, parsed on read.
  price_display: string | null;
  amenities: string[];
  cancellation_policy: string | null;
  unavailability_reason: string | null;
};

export type Vote = {
  listing_id: string;
  voter_id: string;
  voter_name: string;
  value: 1 | -1;
  created_at: string;
};

export type Comment = {
  id: string;
  listing_id: string;
  voter_id: string;
  voter_name: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};

export type ListingWithStats = Listing & {
  votes: Vote[];
  comments: Comment[];
  score: number;
  upvotes: number;
  downvotes: number;
};

export type Voter = {
  id: string;
  name: string;
  name_key: string;
  created_at: string;
};

export type PodiumEntry = {
  title: string | null;
  short_title: string | null;
  location: string | null;
  image_url: string | null;
  url: string;
  score: number;
  upvotes: number;
  downvotes: number;
  added_by_name: string | null;
  /** 1 = gold, 2 = silver, 3 = bronze. Multiple entries can share the same tier when their scores tie. */
  tier: 1 | 2 | 3;
};

export type PastBattle = {
  id: string;
  name: string;
  check_in: string | null;
  check_out: string | null;
  organizer_name: string | null;
  participant_names: string[];
  podium: PodiumEntry[];
  total_listings: number;
  total_votes: number;
  total_comments: number;
  closed_at: string;
  created_at: string;
};

export type Place = {
  id: string;
  name: string;
  url: string | null;
  latitude: number;
  longitude: number;
  kind: string;
  added_by_name: string | null;
  created_at: string;
};
