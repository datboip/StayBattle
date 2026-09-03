import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Integration test for scripts/admin/reset-demo.mjs — the nightly job on
// the public demo. Regression: it wiped the whole `settings` table, which
// dropped the `availability_reset_v1` flag that db.ts checks at boot. The
// next container start re-ran the one-shot wipe and nulled every
// availability status, so all 24 demo listings sat on "checking…" forever.

const ROOT = join(__dirname, "..", "..");
const SCRIPT = join(ROOT, "scripts", "admin", "reset-demo.mjs");

async function freshDb() {
  const dir = mkdtempSync(join(tmpdir(), "sb-reset-demo-"));
  process.env.STAYBATTLE_DB_DIR = dir;
  const { db } = await import("./db");
  const ins = db.prepare(
    "insert into listings (id, url, title) values (?, ?, ?)",
  );
  for (let i = 0; i < 12; i++) {
    ins.run(`l${i}`, `https://www.airbnb.com/rooms/${1000 + i}`, `Listing ${i}`);
  }
  return { dir, db };
}

function runReset(dir: string) {
  execFileSync("node", [SCRIPT], {
    env: { ...process.env, STAYBATTLE_DB_DIR: dir },
    stdio: "pipe",
  });
}

describe("scripts/admin/reset-demo.mjs", () => {
  // db.ts caches its handle on globalThis, so one DB per test file: seed
  // once, run the script once, assert on the result from several angles.
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  beforeAll(async () => {
    const fresh = await freshDb();
    db = fresh.db;
    runReset(fresh.dir);
  });

  it("keeps the one-shot availability wipe disarmed after wiping settings", () => {
    const flag = db
      .prepare("select value from settings where key = 'availability_reset_v1'")
      .get() as { value: string } | undefined;
    expect(flag?.value).toBeTruthy();
  });

  it("bakes a resolved status keyed to the trip dates the app reads", () => {
    const trip = Object.fromEntries(
      (db
        .prepare("select key, value from settings where key in ('trip_check_in','trip_check_out')")
        .all() as { key: string; value: string }[]).map((r) => [r.key, r.value]),
    );
    const rows = db
      .prepare("select availability_status s, availability_dates_key k from listings")
      .all() as { s: string | null; k: string | null }[];
    expect(rows).toHaveLength(12);
    for (const r of rows) {
      expect(r.s).not.toBeNull();
      expect(r.k).toBe(`${trip.trip_check_in}_${trip.trip_check_out}`);
    }
  });
});
