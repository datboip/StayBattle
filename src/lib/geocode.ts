// Geocoding via Nominatim (OpenStreetMap). Free, no API key.
// Nominatim asks that callers set a real User-Agent identifying the app.
// See: https://operations.osmfoundation.org/policies/nominatim/

export type GeocodeResult = {
  name: string;
  latitude: number;
  longitude: number;
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export type Viewbox = {
  // bounding box: [west, south, east, north]
  west: number;
  south: number;
  east: number;
  north: number;
};

async function tryOne(
  q: string,
  viewbox: Viewbox | null,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  if (viewbox) {
    params.set(
      "viewbox",
      `${viewbox.west},${viewbox.north},${viewbox.east},${viewbox.south}`,
    );
    // bounded=1 would *require* the result inside the box; we use it as a soft bias.
  }
  const res = await fetch(`${NOMINATIM}?${params.toString()}`, {
    headers: {
      "User-Agent": "quickie-personal-vacation-app/1.0",
      "Accept-Language": "en",
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    name?: string;
  }>;
  if (!json.length) return null;
  const hit = json[0];
  return {
    name: hit.name || hit.display_name.split(",")[0] || q,
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
  };
}

export function viewboxFromPoints(
  points: { latitude: number; longitude: number }[],
  paddingDeg = 3,
): Viewbox | null {
  if (points.length === 0) return null;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const { latitude, longitude } of points) {
    if (longitude < west) west = longitude;
    if (longitude > east) east = longitude;
    if (latitude < south) south = latitude;
    if (latitude > north) north = latitude;
  }
  return {
    west: west - paddingDeg,
    east: east + paddingDeg,
    south: south - paddingDeg,
    north: north + paddingDeg,
  };
}

// Split "silverlakeresort" into "silver lake resort" using a tiny dictionary
// of common splitters. Cheap, good enough for resort / attraction names.
function unsmush(slug: string): string {
  const words = [
    "silver", "lake", "resort", "hotel", "inn", "park", "world",
    "land", "sea", "spring", "springs", "beach", "ocean", "bay",
    "house", "villa", "village", "city", "town", "club", "spa",
    "ranch", "creek", "island", "harbor", "harbour", "point",
    "ridge", "mountain", "valley", "river", "falls", "marina",
    "garden", "gardens", "grand", "royal", "palms", "palm",
    "disney", "universal", "epcot", "magic", "kingdom",
  ];
  const sorted = [...words].sort((a, b) => b.length - a.length);
  let s = slug.toLowerCase();
  for (const w of sorted) {
    s = s.split(w).join(` ${w} `);
  }
  return s.replace(/\s+/g, " ").trim();
}

export async function geocode(
  query: string,
  viewbox: Viewbox | null = null,
): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  const candidates: string[] = [];
  candidates.push(q);

  try {
    const u = new URL(q);
    const label = u.hostname.replace(/^www\./, "").split(".")[0];
    if (label && label !== q) {
      const unsmushed = unsmush(label);
      if (unsmushed && unsmushed !== label) candidates.push(unsmushed);
      candidates.push(label);
    }
  } catch {}

  // Pass 1: search with the regional bias (if we have one).
  if (viewbox) {
    for (const c of candidates) {
      const hit = await tryOne(c, viewbox);
      if (hit && inViewbox(hit, viewbox)) return hit;
    }
  }
  // Pass 2: unbiased search.
  for (const c of candidates) {
    const hit = await tryOne(c, null);
    if (hit) return hit;
  }
  return null;
}

function inViewbox(p: { latitude: number; longitude: number }, v: Viewbox): boolean {
  return (
    p.longitude >= v.west &&
    p.longitude <= v.east &&
    p.latitude >= v.south &&
    p.latitude <= v.north
  );
}
