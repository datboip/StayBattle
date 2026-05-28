import * as cheerio from "cheerio";

export type ScrapedListing = {
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
};

export function extractAirbnbId(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/rooms(?:\/[a-z_]+)?\/(\d+)/i);
    if (m) return m[1];
    const m2 = u.pathname.match(/\/(?:h|luxury\/listing)\/(\d+)/i);
    if (m2) return m2[1];
  } catch {}
  return null;
}

export function normalizeUrl(url: string): string {
  const id = extractAirbnbId(url);
  if (id) return `https://www.airbnb.com/rooms/${id}`;
  return url;
}

// Standard browser UA — required by the upstream's content negotiation.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeAirbnb(url: string): Promise<ScrapedListing> {
  const canonical = normalizeUrl(url);
  const airbnb_id = extractAirbnbId(canonical);

  const res = await fetch(canonical, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    return { ...empty(airbnb_id) };
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // 1. JSON-LD VacationRental block — primary source of truth.
  const ld = collectJsonLd($);
  const rental =
    ld.find((d) => d?.["@type"] === "VacationRental") ||
    ld.find((d) => d?.["@type"] === "LodgingBusiness") ||
    ld.find((d) => d?.["@type"] === "Product") ||
    ld[0] ||
    null;

  // 2. OG/Twitter tags — used as backup and to parse beds/baths from the title.
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || null;
  const ogDesc =
    $('meta[property="og:description"]').attr("content")?.trim() || null;

  const titleCounts = parseCountsFromTitle(ogTitle);
  const descCounts = parseCountsFromTitle(ogDesc);
  const counts: Counts = {
    guests: titleCounts.guests ?? descCounts.guests,
    bedrooms: titleCounts.bedrooms ?? descCounts.bedrooms,
    beds: titleCounts.beds ?? descCounts.beds,
    bathrooms: titleCounts.bathrooms ?? descCounts.bathrooms,
  };

  // Photos: from JSON-LD if available (full-res array), otherwise OG image.
  const photos = extractPhotos(rental, ogImage, $);

  // Title cleanup: OG title is usually "Rental unit in X · ★4.92 · 1 bedroom · 1 bed · 1 bath"
  // The rental.name is usually the more pleasant marketing title.
  const title = (rental?.name as string) || ogTitle || $("title").text().trim() || null;

  // Location: prefer JSON-LD address.
  const location = extractLocation(rental) || extractLocationFromTitle(ogTitle);
  const latitude = numOrNull(rental?.latitude);
  const longitude = numOrNull(rental?.longitude);

  const agg = (rental?.aggregateRating ?? null) as
    | { ratingValue?: unknown; ratingCount?: unknown; reviewCount?: unknown }
    | null;
  const rating = numOrNull(agg?.ratingValue);
  const review_count = numOrNull(agg?.ratingCount) ?? numOrNull(agg?.reviewCount);

  return {
    airbnb_id,
    title,
    image_url: photos[0] || ogImage,
    photos,
    price_per_night: null, // Airbnb requires check-in/out dates for pricing.
    currency: null,
    location,
    latitude,
    longitude,
    bedrooms: counts.bedrooms ?? null,
    bathrooms: counts.bathrooms ?? null,
    beds: counts.beds ?? null,
    max_guests: counts.guests ?? null,
    rating,
    review_count,
  };
}

function empty(airbnb_id: string | null): ScrapedListing {
  return {
    airbnb_id,
    title: null,
    image_url: null,
    photos: [],
    latitude: null,
    longitude: null,
    price_per_night: null,
    currency: null,
    location: null,
    bedrooms: null,
    bathrooms: null,
    beds: null,
    max_guests: null,
    rating: null,
    review_count: null,
  };
}

type JsonLdNode = Record<string, unknown> & { "@type"?: string };

function collectJsonLd($: cheerio.CheerioAPI): JsonLdNode[] {
  const out: JsonLdNode[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {}
  });
  return out;
}

function extractPhotos(
  rental: JsonLdNode | null,
  ogImage: string | null,
  $: cheerio.CheerioAPI,
): string[] {
  const set = new Set<string>();

  // JSON-LD image field — typically a string OR an array of strings/objects.
  const img = rental?.image as unknown;
  if (Array.isArray(img)) {
    for (const x of img) {
      if (typeof x === "string") set.add(x);
      else if (x && typeof x === "object" && typeof (x as { url?: string }).url === "string") {
        set.add((x as { url: string }).url);
      }
    }
  } else if (typeof img === "string") {
    set.add(img);
  }

  if (set.size === 0 && ogImage) set.add(ogImage);

  // Top up from <img> tags pointing at the Airbnb image CDN. Used to gate
  // this behind "if size < 4" — but JSON-LD typically only ships 8 photos,
  // and a 6-bedroom listing can't be summarized in 8 shots. Always scanning
  // pulls in additional carousel images that aren't in JSON-LD.
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (
      src.includes("muscache.com") &&
      !src.includes("profile_pic") &&
      !src.includes("/avatars/") &&
      !src.includes("/users/")
    ) {
      set.add(src);
    }
  });

  // Cap at 24 — enough to cover most 4-6 bedroom listings; beyond that the
  // carousel UI starts to be the limiting factor anyway. The deferred-state
  // JSON in the page has more, mining that is a TODO.
  return Array.from(set).slice(0, 24);
}

function extractLocation(rental: JsonLdNode | null): string | null {
  if (!rental) return null;
  const addr = rental.address as
    | { addressLocality?: string; addressRegion?: string; addressCountry?: string }
    | undefined;
  if (!addr) return null;
  return [addr.addressLocality, addr.addressRegion, addr.addressCountry]
    .filter(Boolean)
    .join(", ") || null;
}

function extractLocationFromTitle(title: string | null): string | null {
  if (!title) return null;
  // e.g. "Rental unit in Edinburgh · ★4.92 · ..."
  const m = title.match(/\bin\s+([^·]+?)(?:\s*[·•]|$)/i);
  return m ? m[1].trim() : null;
}

type Counts = {
  guests: number | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
};

function parseCountsFromTitle(text: string | null): Counts {
  const empty: Counts = { guests: null, bedrooms: null, beds: null, bathrooms: null };
  if (!text) return empty;
  const numFrom = (re: RegExp) => {
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    guests: numFrom(/(\d+)\s*(?:guests?|travelers?)/i),
    bedrooms: numFrom(/(\d+(?:\.\d+)?)\s*bedrooms?/i),
    beds: numFrom(/(\d+(?:\.\d+)?)\s*beds?\b/i),
    bathrooms: numFrom(/(\d+(?:\.\d+)?)\s*(?:private |shared |half-)?baths?/i),
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}
