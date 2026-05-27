import { describe, expect, it } from "vitest";
import { formatDuration } from "./routing";

describe("formatDuration", () => {
  it("uses '<1min' under 60s", () => {
    expect(formatDuration(0)).toBe("<1min");
    expect(formatDuration(45)).toBe("<1min");
    expect(formatDuration(59)).toBe("<1min");
  });

  it("rounds to minutes between 1min and 60min", () => {
    expect(formatDuration(60)).toBe("1min");
    expect(formatDuration(90)).toBe("2min"); // 1.5 → 2
    expect(formatDuration(720)).toBe("12min");
    expect(formatDuration(3540)).toBe("59min");
  });

  it("uses hours + minutes over 60min", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3660)).toBe("1h 1min");
    expect(formatDuration(7200)).toBe("2h");
    expect(formatDuration(8400)).toBe("2h 20min");
  });

  it("collapses to bare hours when minutes round to 0", () => {
    // 3599 → 60min (round up) → but formatDuration enters the hours
    // branch only at >=3600. Verify the boundary doesn't drift.
    expect(formatDuration(3599)).toBe("60min");
    expect(formatDuration(3600)).toBe("1h");
  });
});
