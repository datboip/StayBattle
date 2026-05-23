import { describe, expect, it } from "vitest";
import { consume } from "./rate-limit";

describe("consume token bucket", () => {
  it("allows up to capacity in a burst", () => {
    const limit = { capacity: 3, refillPerSecond: 0 };
    const key = `burst-${Math.random()}`;
    expect(consume(key, limit)).toBe(true);
    expect(consume(key, limit)).toBe(true);
    expect(consume(key, limit)).toBe(true);
    expect(consume(key, limit)).toBe(false);
  });

  it("refills tokens over time", async () => {
    const limit = { capacity: 1, refillPerSecond: 100 }; // 1 token per 10ms
    const key = `refill-${Math.random()}`;
    expect(consume(key, limit)).toBe(true);
    expect(consume(key, limit)).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(consume(key, limit)).toBe(true);
  });

  it("keeps separate buckets per subject", () => {
    const limit = { capacity: 1, refillPerSecond: 0 };
    const a = `sep-a-${Math.random()}`;
    const b = `sep-b-${Math.random()}`;
    expect(consume(a, limit)).toBe(true);
    expect(consume(b, limit)).toBe(true);
    expect(consume(a, limit)).toBe(false);
  });
});
