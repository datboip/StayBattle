import { describe, expect, it } from "vitest";
import { extractAirbnbId, normalizeUrl } from "./scrape";

describe("extractAirbnbId", () => {
  it("extracts id from a canonical rooms URL", () => {
    expect(extractAirbnbId("https://www.airbnb.com/rooms/1606609223961978288")).toBe(
      "1606609223961978288",
    );
  });

  it("extracts id from a /rooms/plus/ URL", () => {
    expect(extractAirbnbId("https://www.airbnb.com/rooms/plus/12345")).toBe(
      "12345",
    );
  });

  it("extracts id from a URL with query params", () => {
    expect(
      extractAirbnbId(
        "https://www.airbnb.com/rooms/1606609223961978288?check_in=2030-08-11",
      ),
    ).toBe("1606609223961978288");
  });

  it("extracts id from a /h/ slug URL", () => {
    expect(extractAirbnbId("https://www.airbnb.com/h/12345")).toBe("12345");
  });

  it("returns null for non-rooms URLs", () => {
    expect(extractAirbnbId("https://www.airbnb.com/users/show/12345")).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    expect(extractAirbnbId("not a url")).toBeNull();
  });
});

describe("normalizeUrl", () => {
  it("strips tracking params and reduces to canonical /rooms/<id>", () => {
    expect(
      normalizeUrl(
        "https://www.airbnb.com/rooms/12345?check_in=2030-08-11&source_impression_id=abc",
      ),
    ).toBe("https://www.airbnb.com/rooms/12345");
  });

  it("leaves URLs without an id alone", () => {
    expect(normalizeUrl("https://www.airbnb.com/help")).toBe(
      "https://www.airbnb.com/help",
    );
  });
});
