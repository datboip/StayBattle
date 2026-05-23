// Shorten Airbnb's "marketing soup" titles into something readable.
//
// Airbnb titles are typically pipe-separated word-vomit:
//   "Dream VILLA | POOL/SPA| GAME Room|10 Min to Disney"
//   "*Lakefront Pool Home *paddleboard*kayak*game room*"
//   "5 Bd/ 4.5 Ba Sleeps 14! Solterra Resort (7869 OL)"
//
// We pick the most "name-like" segment and clean it up.

const MAX_TITLE_LEN = 32;

/**
 * Smart title case: capitalize the first letter of each word, lower-case the
 * rest — but leave short (≤4 char) ALL-CAPS tokens alone so legitimate
 * acronyms like "BBQ", "BR", "PJs" survive.
 */
export function titleCase(input: string): string {
  return input.replace(/\b([a-zA-Z])([a-zA-Z]*)\b/g, (match, first, rest) => {
    if (match === match.toUpperCase() && match.length <= 4) return match;
    return (first as string).toUpperCase() + (rest as string).toLowerCase();
  });
}

export function shortTitle(title: string | null): string {
  if (!title) return "";
  const original = title.trim();
  let s = original;

  // 1. Split on the dominant separator and pick a usable chunk.
  if (s.includes("|")) {
    s = (s.split("|")[0] ?? "").trim() || s;
  } else if (/[*•·]/.test(s)) {
    const chunks = s
      .split(/[*•·]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (chunks.length > 0) {
      // Pick the longest chunk — usually the actual name vs. one-word features.
      s = chunks.slice().sort((a, b) => b.length - a.length)[0];
    }
  }

  // 2. Drop trailing parenthetical codes like "(7869 OL)" or "[#123]" BEFORE
  // we strip decoration — otherwise we'd eat the closing bracket and break
  // the bracket-pair match.
  s = s.replace(/\s*[(\[][^)\]]{1,20}[)\]]\s*$/, "");

  // 3. Strip leading/trailing decoration + emoji-ish symbols.
  s = s.replace(/^[\s\-~_!#@(\[\]+~`'"]+/, "").replace(/[\s\-~_!#@)\]\[+~`'"]+$/, "");

  // If the cleaning left us with nothing useful (too short, or just stats),
  // fall back to the original title — better verbose than empty.
  if (s.length < 4) s = original;

  // 4. Cap length at a word boundary so we don't snap mid-word.
  if (s.length > MAX_TITLE_LEN) {
    const cut = s.slice(0, MAX_TITLE_LEN);
    const lastSpace = cut.lastIndexOf(" ");
    s = lastSpace > 14 ? cut.slice(0, lastSpace) : cut;
    s = s.replace(/[\s\-_]+$/, "") + "…";
  }

  // 5. Title-case (preserves short acronyms).
  return titleCase(s).trim();
}

/** Pull just the city/locality out of a "Kissimmee, Florida, US" style string. */
export function shortCity(location: string | null): string {
  if (!location) return "";
  return location.split(",")[0].trim();
}

/** "Dream Villa — Kissimmee" — the full display name we use on cards. */
export function shortDisplayName(
  title: string | null,
  location: string | null,
): string {
  const t = shortTitle(title);
  const c = shortCity(location);
  if (t && c) return `${t} — ${c}`;
  return t || c || "Untitled";
}
