import { describe, expect, it } from "vitest";
import { generateInviteCode, normalizeInviteCode } from "./battle";

describe("generateInviteCode", () => {
  it("returns the requested length", () => {
    expect(generateInviteCode(4)).toHaveLength(4);
    expect(generateInviteCode(8)).toHaveLength(8);
  });

  it("defaults to length 6", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("only uses the friendly alphabet (no 0/O/1/I)", () => {
    // L is OK because we uppercase, and uppercase L is distinct from 1 in
    // most fonts. The chars that *cause* misreads are 0/O and 1/I.
    const banned = /[0O1I]/;
    for (let i = 0; i < 50; i++) {
      expect(banned.test(generateInviteCode(12))).toBe(false);
    }
  });
});

describe("normalizeInviteCode", () => {
  it("uppercases", () => {
    expect(normalizeInviteCode("abc123")).toBe("ABC123");
  });

  it("strips whitespace and dashes", () => {
    expect(normalizeInviteCode("  ab-c1 23 ")).toBe("ABC123");
  });

  it("rejects non-alphanumeric characters silently", () => {
    expect(normalizeInviteCode("a!b@c#1$2%3")).toBe("ABC123");
  });
});
