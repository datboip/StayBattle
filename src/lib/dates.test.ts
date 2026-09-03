import { describe, expect, it } from "vitest";
import { nextDayIso, resolveCheckOut } from "./dates";

describe("nextDayIso", () => {
  it("adds one calendar day", () => {
    expect(nextDayIso("2026-09-11")).toBe("2026-09-12");
  });
  it("rolls over month boundaries", () => {
    expect(nextDayIso("2026-09-30")).toBe("2026-10-01");
  });
  it("rolls over year boundaries", () => {
    expect(nextDayIso("2026-12-31")).toBe("2027-01-01");
  });
  it("returns empty for a blank or bad date", () => {
    expect(nextDayIso("")).toBe("");
    expect(nextDayIso("nope")).toBe("");
  });
});

describe("resolveCheckOut", () => {
  // When check-in changes, what should check-out become?
  it("defaults an empty check-out to the day after check-in", () => {
    expect(resolveCheckOut("2026-09-11", "")).toBe("2026-09-12");
  });
  it("bumps a check-out that is now on/before the new check-in", () => {
    expect(resolveCheckOut("2026-09-11", "2026-09-11")).toBe("2026-09-12");
    expect(resolveCheckOut("2026-09-11", "2026-09-05")).toBe("2026-09-12");
  });
  it("leaves a still-valid check-out alone", () => {
    expect(resolveCheckOut("2026-09-11", "2026-09-20")).toBe("2026-09-20");
  });
  it("returns the existing check-out when check-in is cleared", () => {
    expect(resolveCheckOut("", "2026-09-20")).toBe("2026-09-20");
  });
});
