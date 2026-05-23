// Pure-logic tests for the tier-grouping algorithm. The actual function lives
// inside archiveCurrentBattle (server-only) because it touches the DB, so we
// re-implement the deterministic part here and test it directly. If the algo
// is changed in past-battles-server.ts, this file should be updated to match.

import { describe, expect, it } from "vitest";

type Listing = { id: string; score: number; engagement: number; title: string };

function rank(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.engagement !== a.engagement) return b.engagement - a.engagement;
    return a.title.localeCompare(b.title);
  });
}

function tiers(listings: Listing[]) {
  const ranked = rank(listings);
  const out: { tier: 1 | 2 | 3; ids: string[]; score: number }[] = [];
  let currentScore: number | null = null;
  let t: 1 | 2 | 3 = 1;
  for (const l of ranked) {
    if (currentScore !== null && l.score !== currentScore) {
      if (t >= 3) break;
      t = (t + 1) as 1 | 2 | 3;
    }
    currentScore = l.score;
    const existing = out.find((x) => x.tier === t);
    if (existing) existing.ids.push(l.id);
    else out.push({ tier: t, ids: [l.id], score: l.score });
  }
  return out;
}

const L = (id: string, score: number, engagement = 0, title = id): Listing => ({
  id,
  score,
  engagement,
  title,
});

describe("podium tier grouping", () => {
  it("assigns clear gold/silver/bronze when no ties", () => {
    const out = tiers([L("a", 5), L("b", 3), L("c", 1)]);
    expect(out).toEqual([
      { tier: 1, ids: ["a"], score: 5 },
      { tier: 2, ids: ["b"], score: 3 },
      { tier: 3, ids: ["c"], score: 1 },
    ]);
  });

  it("groups all tied listings into a shared tier", () => {
    const out = tiers([L("a", 5), L("b", 5), L("c", 3)]);
    expect(out).toEqual([
      { tier: 1, ids: ["a", "b"], score: 5 },
      { tier: 2, ids: ["c"], score: 3 },
    ]);
  });

  it("three-way tie for gold leaves no silver or bronze below the same score", () => {
    const out = tiers([L("a", 5), L("b", 5), L("c", 5), L("d", 2)]);
    expect(out[0]).toEqual({ tier: 1, ids: ["a", "b", "c"], score: 5 });
    expect(out[1]).toEqual({ tier: 2, ids: ["d"], score: 2 });
  });

  it("breaks score ties by engagement (total votes)", () => {
    const out = tiers([L("calm", 1, 1), L("hot", 1, 10), L("c", 0)]);
    expect(out[0].ids).toEqual(["hot", "calm"]);
  });

  it("breaks engagement ties alphabetically (deterministic)", () => {
    const out = tiers([L("Z", 1, 5, "Z"), L("A", 1, 5, "A")]);
    expect(out[0].ids).toEqual(["A", "Z"]);
  });

  it("caps at 3 tiers even when many distinct scores exist", () => {
    const out = tiers([
      L("a", 5),
      L("b", 4),
      L("c", 3),
      L("d", 2),
      L("e", 1),
    ]);
    expect(out).toHaveLength(3);
    expect(out.map((t) => t.tier)).toEqual([1, 2, 3]);
  });

  it("handles a single listing as gold-by-default", () => {
    const out = tiers([L("only", 0)]);
    expect(out).toEqual([{ tier: 1, ids: ["only"], score: 0 }]);
  });

  it("handles all-zero-score listings as a single gold tie", () => {
    const out = tiers([L("a", 0), L("b", 0), L("c", 0)]);
    expect(out).toEqual([{ tier: 1, ids: ["a", "b", "c"], score: 0 }]);
  });

  it("returns nothing for empty input", () => {
    expect(tiers([])).toEqual([]);
  });
});
