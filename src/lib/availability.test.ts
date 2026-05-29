import { describe, expect, it } from "vitest";
import { graphqlResultToStatus, datesKey } from "./availability";
import {
  parseAvailabilityResponse,
  roomIdFromUrl,
} from "./airbnb-graphql";

// Minimal response factories shaped like Airbnb's actual GraphQL output —
// only the path we read.
function responseEnvelope(section: Record<string, unknown> | null) {
  const sections = section ? [{ sectionId: "BOOK_IT_SIDEBAR", section }] : [];
  return {
    data: {
      presentation: {
        stayProductDetailPage: {
          sections: { sections },
        },
      },
    },
  };
}

describe("parseAvailabilityResponse", () => {
  it("reads available=true + price when Airbnb says these dates work", () => {
    const json = responseEnvelope({
      available: true,
      localizedUnavailabilityMessage: null,
      structuredDisplayPrice: {
        primaryLine: { discountedPrice: "$541", originalPrice: "$600" },
      },
    });
    const r = parseAvailabilityResponse(json);
    expect(r.available).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.priceDisplay).toBe("$541");
    expect(r.error).toBe(false);
  });

  it("treats a non-null localizedUnavailabilityMessage as unavailable", () => {
    // This is the min-stay case: available=true but blocked anyway.
    const json = responseEnvelope({
      available: true,
      localizedUnavailabilityMessage: "3 night minimum",
      structuredDisplayPrice: null,
    });
    const r = parseAvailabilityResponse(json);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("3 night minimum");
  });

  it("treats available=false as unavailable", () => {
    const json = responseEnvelope({
      available: false,
      localizedUnavailabilityMessage: null,
    });
    const r = parseAvailabilityResponse(json);
    expect(r.available).toBe(false);
  });

  it("falls back to originalPrice when discountedPrice is absent", () => {
    const json = responseEnvelope({
      available: true,
      localizedUnavailabilityMessage: null,
      structuredDisplayPrice: {
        primaryLine: { originalPrice: "$200" },
      },
    });
    expect(parseAvailabilityResponse(json).priceDisplay).toBe("$200");
  });

  it("returns error=true when the response shape is unrecognised", () => {
    expect(parseAvailabilityResponse({}).error).toBe(true);
    expect(parseAvailabilityResponse(null).error).toBe(true);
    expect(parseAvailabilityResponse(responseEnvelope(null)).error).toBe(true);
  });
});

describe("graphqlResultToStatus", () => {
  const empty = {
    amenities: [],
    amenityTitles: [],
    cancellationPolicy: null,
    photos: [],
  };
  it("maps available → 'available'", () => {
    expect(
      graphqlResultToStatus({
        available: true,
        reason: null,
        priceDisplay: "$541",
        error: false,
        ...empty,
      }),
    ).toBe("available");
  });

  it("maps unavailable → 'unavailable'", () => {
    expect(
      graphqlResultToStatus({
        available: false,
        reason: "3 night minimum",
        priceDisplay: null,
        error: false,
        ...empty,
      }),
    ).toBe("unavailable");
  });

  it("maps any error → 'unknown' (never lie when we can't tell)", () => {
    expect(
      graphqlResultToStatus({
        available: false,
        reason: null,
        priceDisplay: null,
        error: true,
        ...empty,
      }),
    ).toBe("unknown");
  });
});

describe("parseAvailabilityResponse — photo extraction", () => {
  function envelopeWithSections(sections: Array<{ sectionId: string; section: Record<string, unknown> }>) {
    return {
      data: {
        presentation: {
          stayProductDetailPage: {
            sections: { sections },
          },
        },
      },
    };
  }

  it("pulls the full album from PHOTO_TOUR_SCROLLABLE_MODAL", () => {
    const json = envelopeWithSections([
      {
        sectionId: "BOOK_IT_SIDEBAR",
        section: { available: true, localizedUnavailabilityMessage: null },
      },
      {
        sectionId: "PHOTO_TOUR_SCROLLABLE_MODAL",
        section: {
          mediaItems: [
            { baseUrl: "https://a0.muscache.com/im/1.jpg" },
            { baseUrl: "https://a0.muscache.com/im/2.jpg" },
            { baseUrl: "https://a0.muscache.com/im/3.jpg" },
          ],
        },
      },
    ]);
    expect(parseAvailabilityResponse(json).photos).toEqual([
      "https://a0.muscache.com/im/1.jpg",
      "https://a0.muscache.com/im/2.jpg",
      "https://a0.muscache.com/im/3.jpg",
    ]);
  });

  it("falls back to HERO_DEFAULT.previewImages when the modal is absent", () => {
    const json = envelopeWithSections([
      {
        sectionId: "BOOK_IT_SIDEBAR",
        section: { available: true, localizedUnavailabilityMessage: null },
      },
      {
        sectionId: "HERO_DEFAULT",
        section: {
          previewImages: [
            { baseUrl: "https://a0.muscache.com/im/hero1.jpg" },
            { baseUrl: "https://a0.muscache.com/im/hero2.jpg" },
          ],
        },
      },
    ]);
    expect(parseAvailabilityResponse(json).photos).toEqual([
      "https://a0.muscache.com/im/hero1.jpg",
      "https://a0.muscache.com/im/hero2.jpg",
    ]);
  });

  it("dedupes across modal + hero and keeps modal order first", () => {
    const json = envelopeWithSections([
      {
        sectionId: "BOOK_IT_SIDEBAR",
        section: { available: true, localizedUnavailabilityMessage: null },
      },
      {
        sectionId: "PHOTO_TOUR_SCROLLABLE_MODAL",
        section: {
          mediaItems: [
            { baseUrl: "https://a0.muscache.com/im/1.jpg" },
            { baseUrl: "https://a0.muscache.com/im/2.jpg" },
          ],
        },
      },
      {
        sectionId: "HERO_DEFAULT",
        section: {
          previewImages: [
            { baseUrl: "https://a0.muscache.com/im/1.jpg" }, // dupe
            { baseUrl: "https://a0.muscache.com/im/hero-only.jpg" },
          ],
        },
      },
    ]);
    expect(parseAvailabilityResponse(json).photos).toEqual([
      "https://a0.muscache.com/im/1.jpg",
      "https://a0.muscache.com/im/2.jpg",
      "https://a0.muscache.com/im/hero-only.jpg",
    ]);
  });

  it("returns empty photos when neither section is present", () => {
    const json = envelopeWithSections([
      {
        sectionId: "BOOK_IT_SIDEBAR",
        section: { available: true, localizedUnavailabilityMessage: null },
      },
    ]);
    expect(parseAvailabilityResponse(json).photos).toEqual([]);
  });

  it("rejects URLs from non-Airbnb hosts (defensive against response poisoning)", () => {
    const json = envelopeWithSections([
      {
        sectionId: "BOOK_IT_SIDEBAR",
        section: { available: true, localizedUnavailabilityMessage: null },
      },
      {
        sectionId: "PHOTO_TOUR_SCROLLABLE_MODAL",
        section: {
          mediaItems: [
            { baseUrl: "https://a0.muscache.com/im/good.jpg" },
            { baseUrl: "https://evil.example.com/track.gif" },
            { baseUrl: "javascript:alert(1)" },
            { baseUrl: "https://muscache.com.attacker.test/x.jpg" },
            { baseUrl: "https://en.airbnbusercontent.com/ok.jpg" },
          ],
        },
      },
    ]);
    expect(parseAvailabilityResponse(json).photos).toEqual([
      "https://a0.muscache.com/im/good.jpg",
      "https://en.airbnbusercontent.com/ok.jpg",
    ]);
  });

  it("tolerates url/picture field variants for older shapes", () => {
    const json = envelopeWithSections([
      {
        sectionId: "BOOK_IT_SIDEBAR",
        section: { available: true, localizedUnavailabilityMessage: null },
      },
      {
        sectionId: "PHOTO_TOUR_SCROLLABLE_MODAL",
        section: {
          mediaItems: [
            { url: "https://a0.muscache.com/im/url-style.jpg" },
            { picture: "https://a0.muscache.com/im/picture-style.jpg" },
            { baseUrl: null, url: null }, // garbage
          ],
        },
      },
    ]);
    expect(parseAvailabilityResponse(json).photos).toEqual([
      "https://a0.muscache.com/im/url-style.jpg",
      "https://a0.muscache.com/im/picture-style.jpg",
    ]);
  });
});

describe("roomIdFromUrl", () => {
  it("pulls the numeric ID from a standard /rooms/ URL", () => {
    expect(roomIdFromUrl("https://www.airbnb.com/rooms/1577131465999341173")).toBe(
      "1577131465999341173",
    );
  });

  it("ignores query params and trailing slashes", () => {
    expect(
      roomIdFromUrl(
        "https://www.airbnb.com/rooms/1482129652111008338?check_in=2030-08-11",
      ),
    ).toBe("1482129652111008338");
  });

  it("returns null for non-listing URLs", () => {
    expect(roomIdFromUrl("https://www.airbnb.com/")).toBeNull();
    expect(roomIdFromUrl("not a url")).toBeNull();
  });
});

describe("datesKey", () => {
  it("returns a stable string per date pair", () => {
    expect(datesKey("2030-08-11", "2030-08-15")).toBe("2030-08-11_2030-08-15");
  });

  it("is order-sensitive", () => {
    expect(datesKey("2030-08-11", "2030-08-15")).not.toBe(
      datesKey("2030-08-15", "2030-08-11"),
    );
  });
});
