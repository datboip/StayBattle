/**
 * Curated category set for dropped reference places on the map.
 *
 * Categories drive both the picker in the drop-pin form and the marker
 * color/emoji on the map, so 30 pins in Orlando still scan as "theme
 * parks vs. groceries vs. airports" at a glance.
 *
 * `id` is what we persist in `places.kind`. The legacy value `"reference"`
 * predates this list and is treated as `"other"` for display.
 *
 * `color` is the marker dot fill. Picked for hue separation at small
 * sizes — adjacent categories on this list should not look alike.
 */
export type PlaceCategoryId =
  | "theme-park"
  | "restaurant"
  | "bar"
  | "beach"
  | "museum"
  | "airport"
  | "grocery"
  | "nature"
  | "shopping"
  | "other";

export type PlaceCategory = {
  id: PlaceCategoryId;
  label: string;
  emoji: string;
  /** Marker dot fill, hex. Keep these distinct at 18px. */
  color: string;
};

export const PLACE_CATEGORIES: PlaceCategory[] = [
  { id: "theme-park", label: "Theme park", emoji: "🎢", color: "#a78bfa" },
  { id: "restaurant", label: "Restaurant", emoji: "🍽", color: "#fb7185" },
  { id: "bar",        label: "Bar",         emoji: "🍺", color: "#fbbf24" },
  { id: "beach",      label: "Beach",       emoji: "🏖", color: "#22d3ee" },
  { id: "museum",     label: "Museum",      emoji: "🏛", color: "#d6d3d1" },
  { id: "airport",    label: "Airport",     emoji: "✈",  color: "#7dd3fc" },
  { id: "grocery",    label: "Grocery",     emoji: "🛒", color: "#34d399" },
  { id: "nature",     label: "Outdoors",    emoji: "🌳", color: "#86efac" },
  { id: "shopping",   label: "Shopping",    emoji: "🛍", color: "#f0abfc" },
  { id: "other",      label: "Other",       emoji: "📍", color: "#a1a1aa" },
];

const BY_ID = new Map(PLACE_CATEGORIES.map((c) => [c.id as string, c]));

/**
 * Resolve a stored `places.kind` (may be a legacy "reference" or junk from
 * a hand-edited row) to a known category. Falls back to "other" so the
 * map and form always have a valid render target.
 */
export function resolvePlaceCategory(kind: string | null | undefined): PlaceCategory {
  if (kind && BY_ID.has(kind)) return BY_ID.get(kind)!;
  return BY_ID.get("other")!;
}

export function isKnownPlaceCategoryId(kind: string): kind is PlaceCategoryId {
  return BY_ID.has(kind);
}
