import { describe, expect, it } from "vitest";
import { haversineKm, formatKm, nearestPlaces } from "./distance";

describe("haversineKm", () => {
  it("returns 0 for the same point", () => {
    const p = { lat: 28.5, lng: -81.4 };
    expect(haversineKm(p, p)).toBe(0);
  });

  it("matches the known Orlando → LAX great-circle distance (±1%)", () => {
    // MCO: 28.4312, -81.3081  ·  LAX: 33.9416, -118.4085
    // Great-circle distance ≈ 3560 km per Wolfram + airport-distance tables.
    const km = haversineKm(
      { lat: 28.4312, lng: -81.3081 },
      { lat: 33.9416, lng: -118.4085 },
    );
    expect(km).toBeGreaterThan(3525);
    expect(km).toBeLessThan(3595);
  });

  it("is symmetric", () => {
    const a = { lat: 28.4177, lng: -81.5812 };
    const b = { lat: 28.3766, lng: -81.3993 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe("formatKm", () => {
  it("uses meters under 1km", () => {
    expect(formatKm(0.42)).toBe("420m");
    expect(formatKm(0.999)).toBe("999m");
  });

  it("uses one decimal between 1-10km", () => {
    expect(formatKm(4.23)).toBe("4.2km");
    expect(formatKm(9.5)).toBe("9.5km");
  });

  it("rounds to integer over 10km", () => {
    expect(formatKm(18.4)).toBe("18km");
    expect(formatKm(3500)).toBe("3500km");
  });
});

describe("nearestPlaces", () => {
  const origin = { lat: 28.5, lng: -81.4 };
  const candidates = [
    { id: "a", name: "near", kind: "grocery", lat: 28.51, lng: -81.41 },     // ~1.4km
    { id: "b", name: "mid",  kind: "airport", lat: 28.4, lng: -81.3 },       // ~14km
    { id: "c", name: "far",  kind: "beach",   lat: 28.5, lng: -80.6 },       // ~78km
    { id: "d", name: "very-far", kind: "other", lat: 0, lng: 0 },            // ~thousands
  ];

  it("returns the N closest within maxKm, sorted ascending", () => {
    const r = nearestPlaces(origin, candidates, { limit: 3, maxKm: 100 });
    expect(r.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(r[0].km).toBeLessThan(r[1].km);
    expect(r[1].km).toBeLessThan(r[2].km);
  });

  it("drops anything beyond maxKm even if it would fit limit", () => {
    const r = nearestPlaces(origin, candidates, { limit: 5, maxKm: 50 });
    // "very-far" and "far" both exceed 50km
    expect(r.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("respects limit when more candidates are in range", () => {
    const r = nearestPlaces(origin, candidates, { limit: 1, maxKm: 100 });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("a");
  });
});
