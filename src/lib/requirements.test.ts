import { describe, expect, it } from "vitest";
import {
  AMENITY_LABELS,
  parseRequirements,
  serializeRequirements,
  checkListingRequirements,
} from "./requirements";
import { AMENITY_TAGS } from "./airbnb-graphql";

describe("AMENITY_LABELS", () => {
  it("covers every AMENITY_TAG (else the chip picker shows a tag-id)", () => {
    for (const tag of AMENITY_TAGS) {
      expect(AMENITY_LABELS[tag], `missing label for ${tag}`).toBeTruthy();
    }
  });
});

describe("parseRequirements", () => {
  it("returns [] for null/empty/undefined", () => {
    expect(parseRequirements(null)).toEqual([]);
    expect(parseRequirements("")).toEqual([]);
    expect(parseRequirements(undefined)).toEqual([]);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseRequirements("{not json")).toEqual([]);
    expect(parseRequirements("42")).toEqual([]);
    expect(parseRequirements('"wifi"')).toEqual([]);
  });

  it("filters out non-string entries and unknown tags", () => {
    expect(
      parseRequirements(JSON.stringify(["wifi", 42, null, "not-a-real-tag", "pool"])),
    ).toEqual(["wifi", "pool"]);
  });

  it("preserves known tags", () => {
    expect(
      parseRequirements(JSON.stringify(["wifi", "pool", "pet_friendly"])),
    ).toEqual(["wifi", "pool", "pet_friendly"]);
  });
});

describe("serializeRequirements", () => {
  it("dedups + canonicalizes ordering", () => {
    const a = serializeRequirements(["pool", "wifi", "wifi"]);
    const b = serializeRequirements(["wifi", "pool"]);
    expect(a).toBe(b);
  });

  it("round-trips through parseRequirements", () => {
    const tags = ["wifi", "pet_friendly", "ev_charger"] as const;
    expect(parseRequirements(serializeRequirements([...tags]))).toEqual(
      ["wifi", "ev_charger", "pet_friendly"].sort((a, b) =>
        AMENITY_TAGS.indexOf(a as never) - AMENITY_TAGS.indexOf(b as never),
      ),
    );
  });

  it("returns '[]' for empty input", () => {
    expect(serializeRequirements([])).toBe("[]");
  });
});

describe("checkListingRequirements", () => {
  it("is trivially allMet when no requirements", () => {
    const r = checkListingRequirements(["wifi", "pool"], []);
    expect(r.allMet).toBe(true);
    expect(r.matched).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it("partitions matched and missing", () => {
    const r = checkListingRequirements(
      ["wifi", "tv", "kitchen"],
      ["wifi", "pool", "kitchen"],
    );
    expect(r.matched).toEqual(["wifi", "kitchen"]);
    expect(r.missing).toEqual(["pool"]);
    expect(r.allMet).toBe(false);
  });

  it("allMet only when missing is empty", () => {
    const r = checkListingRequirements(
      ["wifi", "pool", "kitchen", "tv"],
      ["wifi", "pool"],
    );
    expect(r.allMet).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("treats a listing with no scraped amenities as missing everything", () => {
    const r = checkListingRequirements([], ["wifi", "pool"]);
    expect(r.matched).toEqual([]);
    expect(r.missing).toEqual(["wifi", "pool"]);
    expect(r.allMet).toBe(false);
  });
});
