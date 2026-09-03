import { describe, expect, it, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// STAYBATTLE_DEMO_MODE=true is the public demo. It must never make live
// Airbnb calls on behalf of anonymous visitors: README promises the listing
// scrape is skipped, and the availability queue is a no-op — so the actions
// that would trigger either have to refuse up front with a clear message,
// instead of silently scraping (addListing) or spinning forever
// (refreshAvailability).

let actions: typeof import("./actions");

beforeAll(async () => {
  process.env.STAYBATTLE_DEMO_MODE = "true";
  process.env.STAYBATTLE_DB_DIR = mkdtempSync(join(tmpdir(), "sb-demo-actions-"));
  actions = await import("./actions");
});

describe("server actions in demo mode", () => {
  it("addListing refuses before scraping or reading cookies", async () => {
    const res = await actions.addListing(
      "https://www.airbnb.com/rooms/12345",
      "Sam",
      "voter-1",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/demo/i);
  });

  it("refreshAvailability refuses instead of queueing nothing", async () => {
    const res = await actions.refreshAvailability();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/demo/i);
  });
});
