import { describe, expect, it } from "vitest";
import { viewboxFromPoints } from "./geocode";

describe("viewboxFromPoints", () => {
  it("returns null for no points", () => {
    expect(viewboxFromPoints([])).toBeNull();
  });

  it("wraps a single point with padding", () => {
    const v = viewboxFromPoints([{ latitude: 30, longitude: -80 }], 2);
    expect(v).toEqual({ west: -82, east: -78, south: 28, north: 32 });
  });

  it("computes a tight box around multiple points", () => {
    const v = viewboxFromPoints(
      [
        { latitude: 28.3, longitude: -81.6 },
        { latitude: 28.6, longitude: -81.4 },
      ],
      1,
    );
    expect(v).toEqual({
      west: -82.6,
      east: -80.4,
      south: 27.3,
      north: 29.6,
    });
  });

  it("uses default padding when not specified", () => {
    const v = viewboxFromPoints([{ latitude: 0, longitude: 0 }]);
    expect(v).toEqual({ west: -3, east: 3, south: -3, north: 3 });
  });
});
