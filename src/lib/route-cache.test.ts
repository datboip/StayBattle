import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let rc: typeof import("./route-cache");

beforeAll(async () => {
  process.env.STAYBATTLE_DB_DIR = mkdtempSync(join(tmpdir(), "sb-routecache-"));
  await import("./db");
  rc = await import("./route-cache");
});

describe("route cache", () => {
  it("reports everything missing when empty", () => {
    const pairs = [{ listingId: "l1", placeId: "p1" }, { listingId: "l1", placeId: "p2" }];
    const { cached, missing } = rc.readRouteCache(pairs);
    expect(cached.size).toBe(0);
    expect(missing).toHaveLength(2);
  });

  it("round-trips written durations and shrinks the missing set", () => {
    rc.writeRouteCache([
      { listingId: "l1", placeId: "p1", seconds: 720 },
      { listingId: "l1", placeId: "p2", seconds: -1 }, // known no-route
    ]);
    const { cached, missing } = rc.readRouteCache([
      { listingId: "l1", placeId: "p1" },
      { listingId: "l1", placeId: "p2" },
      { listingId: "l2", placeId: "p1" },
    ]);
    expect(cached.get("l1:p1")).toBe(720);
    expect(cached.get("l1:p2")).toBe(-1); // cached, even though no route
    expect(missing).toEqual([{ listingId: "l2", placeId: "p1" }]);
  });

  it("upserts an existing pair", () => {
    rc.writeRouteCache([{ listingId: "l1", placeId: "p1", seconds: 999 }]);
    const { cached } = rc.readRouteCache([{ listingId: "l1", placeId: "p1" }]);
    expect(cached.get("l1:p1")).toBe(999);
  });
});
