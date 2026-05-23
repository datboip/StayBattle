import { describe, expect, it } from "vitest";
import { hashPin, verifyPin, isValidPin, normalizeName } from "./auth";

describe("hashPin / verifyPin", () => {
  it("verifies a correct PIN", () => {
    const stored = hashPin("1234");
    expect(verifyPin("1234", stored)).toBe(true);
  });

  it("rejects a wrong PIN", () => {
    const stored = hashPin("1234");
    expect(verifyPin("5678", stored)).toBe(false);
  });

  it("produces a different hash for the same PIN each call (random salt)", () => {
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toBe(b);
    expect(verifyPin("1234", a)).toBe(true);
    expect(verifyPin("1234", b)).toBe(true);
  });

  it("rejects malformed stored values", () => {
    expect(verifyPin("1234", "not-a-hash")).toBe(false);
    expect(verifyPin("1234", "")).toBe(false);
    expect(verifyPin("1234", "abc:")).toBe(false);
  });
});

describe("isValidPin", () => {
  it.each(["1234", "12345", "123456"])("accepts %s", (pin) => {
    expect(isValidPin(pin)).toBe(true);
  });

  it.each(["", "12", "123", "1234567", "abcd", "12 34", "12.34"])(
    "rejects %s",
    (pin) => {
      expect(isValidPin(pin)).toBe(false);
    },
  );
});

describe("normalizeName", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeName("  Alex  Demo  ")).toBe("alex demo");
    expect(normalizeName("ALEX")).toBe("alex");
  });
});
