/**
 * Date-availability check via the upstream's public GraphQL endpoint.
 *
 * The static HTML doesn't carry per-date booking eligibility — the
 * `BookItSection` data is null in SSR and gets populated client-side
 * after page load. We make the equivalent unauthenticated GraphQL
 * call here.
 *
 * The API key is the public web-app key that ships in every page
 * load — not a secret. The persisted-query SHA rotates periodically;
 * when it does, our requests will start returning PersistedQueryNotFound
 * and the constant below needs updating from a current page load.
 */

const AIRBNB_API_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20";

const STAYS_PDP_SECTIONS_HASH =
  "80c7889b4b0027d99ffea830f6c0d4911a6e863a957cbe1044823f0fc746bf1f";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type AvailabilityResult = {
  /** True only when Airbnb's booking widget says these exact dates are bookable. */
  available: boolean;
  /** Human-readable reason when unavailable (e.g. "3 night minimum"). */
  reason: string | null;
  /** Display price for the whole stay (e.g. "$541"). Null if unavailable. */
  priceDisplay: string | null;
  /** Curated amenity tags this listing has — empty array if section missing. */
  amenities: AmenityTag[];
  /**
   * Raw amenity titles (de-duplicated, "available=true" only) for advanced
   * filtering / display. ~30-80 strings per listing typically.
   */
  amenityTitles: string[];
  /** Cancellation policy display string (e.g. "Strict", "Free cancellation"). */
  cancellationPolicy: string | null;
  /**
   * Full photo album from the PDP gallery — typically 30-50 URLs.
   * Sourced from PHOTO_TOUR_SCROLLABLE_MODAL with HERO_DEFAULT as a backup.
   * Empty array if neither section came back (older listings, missing data).
   */
  photos: string[];
  /** True when the request itself failed (network, 4xx, parse error). */
  error: boolean;
};

/**
 * Curated set of amenity tags we surface for filtering. Mapped from
 * Airbnb's free-text amenity titles via fuzzy substring matching — keep
 * this list tight so the chips UI stays usable. Add to it when a real
 * user-requested filter doesn't fit any existing bucket.
 */
export const AMENITY_TAGS = [
  "wifi",
  "pool",
  "hot_tub",
  "kitchen",
  "washer",
  "dryer",
  "air_conditioning",
  "heating",
  "parking",
  "ev_charger",
  "gym",
  "tv",
  "workspace",
  "bbq",
  "pet_friendly",
  "smoke_alarm",
  "carbon_monoxide_alarm",
  "self_check_in",
  "beachfront",
  "lake_access",
  "ski_in_out",
  "crib",
  "high_chair",
] as const;
export type AmenityTag = (typeof AMENITY_TAGS)[number];

// Substring match table: lowercased Airbnb amenity title contains one of
// these → we tag the listing. Multiple substrings can map to the same tag.
const AMENITY_PATTERNS: Record<AmenityTag, RegExp> = {
  wifi: /\b(wifi|wi-fi|internet)\b/i,
  pool: /\bpool\b/i,
  hot_tub: /\b(hot tub|jacuzzi|spa pool|whirlpool)\b/i,
  kitchen: /\b(kitchen|kitchenette)\b/i,
  washer: /\bwasher\b/i,
  dryer: /\bdryer\b/i,
  air_conditioning: /\b(air conditioning|a\/?c\b|central air)\b/i,
  heating: /\b(heating|heater)\b/i,
  parking: /\b(free parking|paid parking|parking on premises|garage)\b/i,
  ev_charger: /\b(ev charger|electric vehicle)\b/i,
  gym: /\b(gym|fitness|exercise equipment)\b/i,
  tv: /\b(tv\b|television|hdtv|smart tv|netflix)\b/i,
  workspace: /\b(workspace|dedicated workspace|desk)\b/i,
  bbq: /\b(bbq|barbecue|barbeque|grill)\b/i,
  pet_friendly: /\b(pets allowed|pet-friendly|pet friendly|dog|cat allowed)\b/i,
  smoke_alarm: /\b(smoke alarm|smoke detector)\b/i,
  carbon_monoxide_alarm: /\b(carbon monoxide|co alarm|co detector)\b/i,
  self_check_in: /\b(self check-?in|keypad|lockbox|smart lock)\b/i,
  beachfront: /\b(beachfront|beach access|on the beach)\b/i,
  lake_access: /\b(lake access|lakefront|on the lake)\b/i,
  ski_in_out: /\b(ski-in|ski-out|ski in\/out)\b/i,
  crib: /\b(crib|cot for infant)\b/i,
  high_chair: /\bhigh chair\b/i,
};

/** Extract the numeric room ID from any standard Airbnb URL. */
export function roomIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/rooms\/(\d+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Airbnb encodes GraphQL node IDs as base64 of "TypeName:numericId". */
function encodeNodeId(type: string, id: string): string {
  return Buffer.from(`${type}:${id}`).toString("base64");
}

/**
 * Ask Airbnb's booking widget whether these dates are bookable for this
 * listing. Returns the structured result + price; the caller is responsible
 * for mapping to our internal AvailabilityStatus type.
 */
export async function checkAvailabilityGraphQL(
  roomId: string,
  checkIn: string,
  checkOut: string,
  adults: number = 1,
  signal?: AbortSignal,
): Promise<AvailabilityResult> {
  const variables = {
    id: encodeNodeId("StayListing", roomId),
    demandStayListingId: encodeNodeId("DemandStayListing", roomId),
    pdpSectionsRequest: {
      adults: String(adults),
      children: null,
      infants: null,
      pets: 0,
      checkIn,
      checkOut,
      layouts: ["SIDEBAR", "SINGLE_COLUMN"],
      // Specific list, not null. Subtle gotcha: `sectionIds: null` returns
      // every section but the BOOK_IT_SIDEBAR.available field comes back as
      // `null` instead of bool/false. Listing each section we actually read
      // makes Airbnb fully populate them. Adding sections here is cheap.
      sectionIds: [
        "BOOK_IT_SIDEBAR",
        "BOOK_IT_FLOATING_FOOTER",
        "AMENITIES_DEFAULT",
        "POLICIES_DEFAULT",
        "HIGHLIGHTS_DEFAULT",
        "HERO_DEFAULT",
        "PHOTO_TOUR_SCROLLABLE_MODAL",
      ],
      bypassTargetings: false,
      privateBooking: false,
      preview: false,
      staysBookingMigrationEnabled: false,
      useNewSectionWrapperApi: false,
    },
  };
  const extensions = {
    persistedQuery: { version: 1, sha256Hash: STAYS_PDP_SECTIONS_HASH },
  };

  const url = new URL(
    `https://www.airbnb.com/api/v3/StaysPdpSections/${STAYS_PDP_SECTIONS_HASH}`,
  );
  url.searchParams.set("operationName", "StaysPdpSections");
  url.searchParams.set("locale", "en");
  url.searchParams.set("currency", "USD");
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("extensions", JSON.stringify(extensions));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Airbnb-Api-Key": AIRBNB_API_KEY,
      },
      signal,
    });
  } catch {
    return emptyResult();
  }

  if (!res.ok) {
    return emptyResult();
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return emptyResult();
  }
  return parseAvailabilityResponse(json);
}

type BookItSection = {
  available?: boolean | null;
  localizedUnavailabilityMessage?: string | null;
  structuredDisplayPrice?: {
    primaryLine?: {
      discountedPrice?: string | null;
      originalPrice?: string | null;
    } | null;
  } | null;
};

type AmenityItem = { title?: string | null; available?: boolean | null };
type AmenityGroup = { amenities?: AmenityItem[] | null };
type AmenitiesSection = {
  seeAllAmenitiesGroups?: AmenityGroup[] | null;
  previewAmenitiesGroups?: AmenityGroup[] | null;
};
type PoliciesSection = {
  cancellationPolicyForDisplay?: { title?: string | null } | string | null;
};

type MediaUrlBearer = {
  baseUrl?: string | null;
  url?: string | null;
  picture?: string | null;
};
type PhotoSection = {
  mediaItems?: MediaUrlBearer[] | null;
  previewImages?: MediaUrlBearer[] | null;
  images?: MediaUrlBearer[] | null;
};

type SectionEntry = {
  sectionId?: string;
  // Union of every section shape we read fields from.
  section?:
    | (BookItSection &
        AmenitiesSection &
        PoliciesSection &
        PhotoSection &
        Record<string, unknown>)
    | null;
};

// Frozen so callers can't accidentally mutate the shared singleton.
// `parseAvailabilityResponse` and the fetch wrappers both used to return
// references that mixed badly with downstream code that pushed onto
// `.amenities` / `.photos`.
const EMPTY_RESULT: Readonly<AvailabilityResult> = Object.freeze({
  available: false,
  reason: null,
  priceDisplay: null,
  amenities: [] as AmenityTag[],
  amenityTitles: [] as string[],
  cancellationPolicy: null,
  photos: [] as string[],
  error: true,
});

/** Fresh, mutable copy of the empty result — use this instead of the singleton. */
function emptyResult(): AvailabilityResult {
  return {
    ...EMPTY_RESULT,
    amenities: [],
    amenityTitles: [],
    photos: [],
  };
}

/**
 * Walk the GraphQL response down to the sections we care about and pull
 * out availability, price, amenities, and cancellation policy. Exported
 * separately so it's unit-testable against fixture JSON without making a
 * real HTTP call.
 */
export function parseAvailabilityResponse(json: unknown): AvailabilityResult {
  try {
    const sections =
      (json as Record<string, unknown>)?.data &&
      ((((json as Record<string, unknown>).data as Record<string, unknown>)
        .presentation as Record<string, unknown>)?.stayProductDetailPage as
        | Record<string, unknown>
        | undefined)?.sections;
    const list =
      ((sections as Record<string, unknown>)?.sections as SectionEntry[]) ??
      [];

    const sidebar = list.find((s) => s.sectionId === "BOOK_IT_SIDEBAR");
    const sec = sidebar?.section ?? null;
    if (!sec) return emptyResult();

    const reason = sec.localizedUnavailabilityMessage ?? null;
    const available = sec.available === true && !reason;
    const priceLine = sec.structuredDisplayPrice?.primaryLine ?? null;
    const priceDisplay =
      priceLine?.discountedPrice ?? priceLine?.originalPrice ?? null;

    const amen = list.find((s) => s.sectionId === "AMENITIES_DEFAULT")?.section;
    const { amenities, amenityTitles } = extractAmenities(amen ?? null);

    const policies = list.find((s) => s.sectionId === "POLICIES_DEFAULT")
      ?.section;
    const cancellationPolicy = extractCancellation(policies ?? null);

    const photos = extractPhotosFromSections(list);

    return {
      available,
      reason,
      priceDisplay,
      amenities,
      amenityTitles,
      cancellationPolicy,
      photos,
      error: false,
    };
  } catch {
    return emptyResult();
  }
}

/**
 * Pull photo URLs from the gallery sections. PHOTO_TOUR_SCROLLABLE_MODAL is
 * the "Show all photos" album (typically 30-50 shots); HERO_DEFAULT carries
 * the carousel above the fold (typically the first 4-8). We take the union,
 * dedupe, and preserve insertion order (album first, then hero).
 *
 * Airbnb shapes media containers under a few names — mediaItems on the
 * modal, previewImages on the hero, occasionally images on older listings.
 * We walk all three and accept any URL-bearing item (baseUrl preferred,
 * then url, then picture).
 */
function extractPhotosFromSections(list: SectionEntry[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (containers: MediaUrlBearer[] | null | undefined) => {
    if (!Array.isArray(containers)) return;
    for (const item of containers) {
      const url = item?.baseUrl || item?.url || item?.picture;
      if (typeof url !== "string" || !url || seen.has(url)) continue;
      if (!isAirbnbCdnUrl(url)) continue;
      seen.add(url);
      out.push(url);
    }
  };
  const album = list.find(
    (s) => s.sectionId === "PHOTO_TOUR_SCROLLABLE_MODAL",
  )?.section;
  push(album?.mediaItems);
  push(album?.images);
  const hero = list.find((s) => s.sectionId === "HERO_DEFAULT")?.section;
  push(hero?.previewImages);
  push(hero?.mediaItems);
  return out;
}

/**
 * Only accept URLs from Airbnb's known CDN hosts. The GraphQL response is
 * trusted upstream BUT lands in our DB and gets rendered in `<img src>` —
 * if the response ever contains a redirect/tracking URL (or a poisoned test
 * fixture sneaks in attacker-controlled values), we don't want that landing
 * in the photos column. Mirrors the muscache filter in scrape.ts.
 */
export function isAirbnbCdnUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return (
      host === "muscache.com" ||
      host.endsWith(".muscache.com") ||
      host === "airbnbusercontent.com" ||
      host.endsWith(".airbnbusercontent.com")
    );
  } catch {
    return false;
  }
}

function extractAmenities(
  sec: AmenitiesSection | null,
): { amenities: AmenityTag[]; amenityTitles: string[] } {
  if (!sec) return { amenities: [], amenityTitles: [] };
  // Prefer the full list (seeAllAmenitiesGroups); fall back to preview.
  const groups =
    sec.seeAllAmenitiesGroups ?? sec.previewAmenitiesGroups ?? [];
  const titleSet = new Set<string>();
  for (const g of groups) {
    for (const item of g?.amenities ?? []) {
      if (item?.available === true && typeof item.title === "string") {
        titleSet.add(item.title.trim());
      }
    }
  }
  const amenityTitles = [...titleSet];
  // Bucket into our curated tag set via substring patterns.
  const joined = amenityTitles.join(" || ").toLowerCase();
  const amenities = AMENITY_TAGS.filter((tag) =>
    AMENITY_PATTERNS[tag].test(joined),
  );
  return { amenities, amenityTitles };
}

function extractCancellation(sec: PoliciesSection | null): string | null {
  if (!sec) return null;
  const raw = sec.cancellationPolicyForDisplay;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && typeof raw.title === "string") {
    return raw.title;
  }
  return null;
}
