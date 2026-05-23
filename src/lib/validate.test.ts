import { describe, expect, it } from "vitest";
import { cleanString, isLikelyUrl, validateAirbnbUrl } from "./validate";

describe("cleanString", () => {
  it("trims whitespace", () => {
    expect(cleanString("  hi  ", 100)).toBe("hi");
  });

  it("returns empty for non-strings", () => {
    expect(cleanString(42 as unknown as string, 100)).toBe("");
    expect(cleanString(null as unknown as string, 100)).toBe("");
    expect(cleanString(undefined as unknown as string, 100)).toBe("");
  });

  it("truncates to max length", () => {
    expect(cleanString("abcdefghij", 5)).toBe("abcde");
  });

  it("strips zero-width characters", () => {
    expect(cleanString("a​b‌c", 100)).toBe("abc");
  });
});

describe("isLikelyUrl", () => {
  it("accepts http and https", () => {
    expect(isLikelyUrl("https://example.com")).toBe(true);
    expect(isLikelyUrl("http://example.com")).toBe(true);
  });

  it("rejects other schemes", () => {
    expect(isLikelyUrl("javascript:alert(1)")).toBe(false);
    expect(isLikelyUrl("file:///etc/passwd")).toBe(false);
    expect(isLikelyUrl("data:text/html,<script>")).toBe(false);
  });

  it("rejects garbage", () => {
    expect(isLikelyUrl("not a url")).toBe(false);
    expect(isLikelyUrl("")).toBe(false);
  });
});

describe("validateAirbnbUrl", () => {
  it("accepts canonical airbnb URLs", () => {
    expect(validateAirbnbUrl("https://www.airbnb.com/rooms/12345")).toBe(
      "https://www.airbnb.com/rooms/12345",
    );
  });

  it("accepts other airbnb TLDs", () => {
    expect(validateAirbnbUrl("https://www.airbnb.co.uk/rooms/12345")).toBe(
      "https://www.airbnb.co.uk/rooms/12345",
    );
  });

  it("rejects lookalike hosts", () => {
    expect(validateAirbnbUrl("https://airbnb.com.attacker.com/rooms/12345")).toBeNull();
    expect(validateAirbnbUrl("https://attacker.com/airbnb.com/rooms/12345")).toBeNull();
    expect(validateAirbnbUrl("https://attacker.com#airbnb.com/rooms/12345")).toBeNull();
  });

  it("strips query, fragment, and credentials", () => {
    expect(
      validateAirbnbUrl("https://user:pass@www.airbnb.com/rooms/12345?check_in=2030-08-11#hash"),
    ).toBe("https://www.airbnb.com/rooms/12345");
  });

  it("rejects unknown schemes", () => {
    expect(validateAirbnbUrl("ftp://www.airbnb.com/rooms/12345")).toBeNull();
    expect(validateAirbnbUrl("javascript:alert(1)")).toBeNull();
  });
});
