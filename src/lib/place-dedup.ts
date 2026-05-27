/**
 * Helpers for de-duplicating dropped pins.
 *
 * When two voters drop a pin for the same place — same name, very close
 * coordinates — we merge the contributor lists instead of creating two
 * rows on the map. Same name + far apart = separate pins (different
 * locations with a shared name, e.g. "Publix"). Different name + same
 * location = separate pins (a strip mall with two businesses).
 *
 * Threshold defaults match `addPlaceAtCoords`. 50m radius is roughly the
 * footprint of a single venue — close enough that "Magic Kingdom" at the
 * gate vs. "Magic Kingdom" 30m away in the parking lot are the same
 * thing; not so loose that two cafes on the same block get merged.
 */

/**
 * Strip casing, punctuation, and runs of whitespace so visually-similar
 * names match: "Publix · Sand Lake" and "publix - sand lake" both
 * normalize to "publix sand lake".
 *
 * Unicode-aware: keeps letters/digits/whitespace from all scripts so
 * non-Latin names (e.g. "東京ドーム") still compare correctly.
 */
export function normalizePlaceName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Parse the comma-separated `added_by_name` string into a clean list,
 * dropping empties and trimming whitespace.
 */
export function parseContributors(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Add `name` to a contributor list, preserving prior order and skipping
 * the add when the contributor is already present (case-insensitive).
 * Returns the merged string ("Alice, Bob") or null when the merge made
 * no change — caller can use the null to skip the DB update entirely.
 */
export function mergeContributor(
  existing: string | null | undefined,
  name: string,
): string | null {
  const list = parseContributors(existing);
  const lowered = list.map((s) => s.toLowerCase());
  const next = name.trim();
  if (!next) return null;
  if (lowered.includes(next.toLowerCase())) return null;
  return [...list, next].join(", ");
}
