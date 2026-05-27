/**
 * Battle-level "must-haves" — the organizer picks a list of amenities
 * every listing should have, and each card shows a ✓ / "Missing: X"
 * row against them.
 *
 * Backed by a single row in `settings(key='battle_requirements')`
 * holding a JSON array of `AmenityTag` strings. Empty / missing row =
 * no requirements set = no row rendered on the cards.
 *
 * Hard vs soft is deferred — v1 ships hard-only ("required") which is
 * what 90% of vacation-rental fights actually argue about (does it have
 * a pool, does it allow pets). A `hard: boolean` field can land later
 * without a schema change since the JSON shape is internal to this
 * module.
 */
import { AMENITY_TAGS, type AmenityTag } from "./airbnb-graphql";

/**
 * Display label for each amenity. Mostly hand-written so the chip
 * picker reads cleanly ("Air conditioning" not "air_conditioning").
 * Kept here next to AMENITY_TAGS so adding a new tag prompts a label.
 */
export const AMENITY_LABELS: Record<AmenityTag, string> = {
  wifi: "Wifi",
  pool: "Pool",
  hot_tub: "Hot tub",
  kitchen: "Kitchen",
  washer: "Washer",
  dryer: "Dryer",
  air_conditioning: "Air conditioning",
  heating: "Heating",
  parking: "Parking",
  ev_charger: "EV charger",
  gym: "Gym",
  tv: "TV",
  workspace: "Workspace",
  bbq: "BBQ",
  pet_friendly: "Pet-friendly",
  smoke_alarm: "Smoke alarm",
  carbon_monoxide_alarm: "CO alarm",
  self_check_in: "Self check-in",
  beachfront: "Beachfront",
  lake_access: "Lake access",
  ski_in_out: "Ski-in/out",
  crib: "Crib",
  high_chair: "High chair",
};

/**
 * Parse the JSON blob from settings.battle_requirements into a
 * whitelist-filtered AmenityTag list. Anything that isn't a known
 * tag is dropped — protects against stale rows from removed tags
 * and against junk written by a future bug.
 */
export function parseRequirements(json: string | null | undefined): AmenityTag[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    const known = new Set<string>(AMENITY_TAGS);
    return parsed.filter((x): x is AmenityTag => typeof x === "string" && known.has(x));
  } catch {
    return [];
  }
}

export function serializeRequirements(tags: AmenityTag[]): string {
  // Dedup + sort by AMENITY_TAGS canonical order so the stored value
  // is stable (two toggles that arrive at the same set produce the
  // same JSON, so write-then-read round-trips don't re-render
  // unnecessarily).
  const set = new Set<AmenityTag>(tags);
  return JSON.stringify(AMENITY_TAGS.filter((t) => set.has(t)));
}

/**
 * Score a listing against the must-have list. Returns:
 *   - matched: tags the listing has
 *   - missing: tags the listing is missing
 *   - allMet:  true iff every required tag is present
 *
 * Empty requirements → trivially allMet=true, matched=missing=[].
 * A listing with `amenities: []` (e.g. no GraphQL data yet) treats
 * everything as missing — the UI is responsible for skipping the
 * "Missing: …" badge when amenities haven't been scraped yet.
 */
export function checkListingRequirements(
  listingAmenities: readonly string[],
  required: AmenityTag[],
): {
  matched: AmenityTag[];
  missing: AmenityTag[];
  allMet: boolean;
} {
  if (required.length === 0) {
    return { matched: [], missing: [], allMet: true };
  }
  const have = new Set(listingAmenities);
  const matched: AmenityTag[] = [];
  const missing: AmenityTag[] = [];
  for (const tag of required) {
    if (have.has(tag)) matched.push(tag);
    else missing.push(tag);
  }
  return { matched, missing, allMet: missing.length === 0 };
}
