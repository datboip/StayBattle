import { describe, expect, it } from "vitest";
import { isValidIsoDate, withTripDates } from "./trip";

describe("isValidIsoDate", () => {
  it("accepts ISO dates", () => {
    expect(isValidIsoDate("2030-08-11")).toBe(true);
    expect(isValidIsoDate("2030-12-31")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidIsoDate("2030-6-1")).toBe(false);
    expect(isValidIsoDate("06/01/2030")).toBe(false);
    expect(isValidIsoDate("not a date")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(isValidIsoDate("2030-02-30")).toBe(false);
    expect(isValidIsoDate("2030-13-01")).toBe(false);
  });
});

describe("withTripDates", () => {
  const url = "https://www.airbnb.com/rooms/12345";

  it("returns url unchanged when dates are missing", () => {
    expect(withTripDates(url, { checkIn: null, checkOut: null })).toBe(url);
    expect(withTripDates(url, { checkIn: "2030-08-11", checkOut: null })).toBe(url);
    expect(withTripDates(url, { checkIn: null, checkOut: "2030-08-15" })).toBe(url);
  });

  it("appends check_in and check_out when both are set", () => {
    const out = withTripDates(url, {
      checkIn: "2030-08-11",
      checkOut: "2030-08-15",
    });
    expect(out).toBe(
      "https://www.airbnb.com/rooms/12345?check_in=2030-08-11&check_out=2030-08-15",
    );
  });

  it("overrides existing check_in / check_out params", () => {
    const out = withTripDates(
      "https://www.airbnb.com/rooms/12345?check_in=2025-01-01&check_out=2025-01-08",
      { checkIn: "2030-08-11", checkOut: "2030-08-15" },
    );
    expect(out).toBe(
      "https://www.airbnb.com/rooms/12345?check_in=2030-08-11&check_out=2030-08-15",
    );
  });

  it("ignores invalid dates without throwing", () => {
    expect(
      withTripDates(url, { checkIn: "not-a-date", checkOut: "2030-08-15" }),
    ).toBe(url);
  });

  it("returns input unchanged for malformed URLs", () => {
    expect(
      withTripDates("not a url", { checkIn: "2030-08-11", checkOut: "2030-08-15" }),
    ).toBe("not a url");
  });
});
