/**
 * Straight-line "as the crow flies" distance between two lat/lng points
 * via the haversine formula. Returns kilometers.
 *
 * Good enough for "this listing is 8km from the airport" copy on the
 * roster — for actual drive times we'd need a routing engine (OSRM/
 * Valhalla), but a straight-line read settles 90% of vacation arguments.
 */
const EARTH_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/**
 * Compact distance label. <1km shows meters ("420m"), <10km shows one
 * decimal ("4.2km"), ≥10km rounds to integer ("18km").
 */
export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

export type DistancePoint = {
  id: string;
  name: string;
  kind: string | null;
  lat: number;
  lng: number;
};

export type NearbyPlace = DistancePoint & { km: number };

/**
 * Top-N nearest places to `origin`, sorted by distance ascending.
 * Anything beyond `maxKm` is dropped — a "nearby" hit 200km away isn't
 * useful, just noise on the card.
 */
export function nearestPlaces(
  origin: { lat: number; lng: number },
  candidates: DistancePoint[],
  { limit = 3, maxKm = 100 }: { limit?: number; maxKm?: number } = {},
): NearbyPlace[] {
  const withDist: NearbyPlace[] = candidates
    .map((c) => ({ ...c, km: haversineKm(origin, c) }))
    .filter((c) => c.km <= maxKm)
    .sort((a, b) => a.km - b.km);
  return withDist.slice(0, limit);
}
