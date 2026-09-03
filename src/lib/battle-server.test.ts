import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A battle whose trip ended more than a week ago blocked the whole server
// (one battle per server) until its organizer signed in with their PIN and
// closed it. getCurrentBattle() already auto-flips submission→voting at
// read time; it now also auto-archives a stale battle the same way the
// organizer's "close battle" does, so the next visitor can start fresh.

let bs: typeof import("./battle-server");
let dbmod: typeof import("./db");

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

beforeAll(async () => {
  process.env.STAYBATTLE_DB_DIR = mkdtempSync(join(tmpdir(), "sb-stale-"));
  dbmod = await import("./db");
  bs = await import("./battle-server");
});

describe("getCurrentBattle auto-archives stale battles", () => {
  it("archives a battle whose check-out was 30 days ago and returns null", () => {
    const b = bs.createBattle({
      name: "Old trip",
      organizer_id: "org-1",
      organizer_name: "dad",
      check_in: isoDaysFromNow(-33),
      check_out: isoDaysFromNow(-30),
      submission_deadline: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    });
    dbmod.db
      .prepare("insert into listings (id, url, title) values (?, ?, ?)")
      .run("l1", "https://www.airbnb.com/rooms/1", "Villa");

    expect(bs.getCurrentBattle()).toBeNull();

    const past = dbmod.db
      .prepare("select name, organizer_name from past_battles")
      .all() as { name: string; organizer_name: string }[];
    expect(past).toEqual([{ name: "Old trip", organizer_name: "dad" }]);
    expect(bs.listParticipants(b.id)).toEqual([]);
    expect(dbmod.db.prepare("select count(*) c from listings").get()).toEqual({ c: 0 });
  });

  it("leaves a current battle alone", () => {
    const b = bs.createBattle({
      name: "Next trip",
      organizer_id: "org-2",
      organizer_name: "mom",
      check_in: isoDaysFromNow(10),
      check_out: isoDaysFromNow(13),
      submission_deadline: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    });
    expect(bs.getCurrentBattle()?.id).toBe(b.id);
    expect(dbmod.db.prepare("select count(*) c from past_battles").get()).toEqual({ c: 1 });
  });
});
