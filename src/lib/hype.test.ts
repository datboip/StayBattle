import { describe, expect, it } from "vitest";
import { listingHype } from "./hype";

type C = { voter_id: string; body: string; created_at: string };
const mk = (added_by_id: string | null, comments: C[]) => ({ added_by_id, comments });

describe("listingHype", () => {
  it("returns the submitter's own comment (their hype)", () => {
    const l = mk("owner", [
      { voter_id: "owner", body: "Private pool!", created_at: "2026-01-01" },
      { voter_id: "someone", body: "meh", created_at: "2026-01-02" },
    ]);
    expect(listingHype(l)).toBe("Private pool!");
  });
  it("uses the most recent owner comment when there are several", () => {
    const l = mk("owner", [
      { voter_id: "owner", body: "first", created_at: "2026-01-01" },
      { voter_id: "owner", body: "the real hype", created_at: "2026-03-01" },
    ]);
    expect(listingHype(l)).toBe("the real hype");
  });
  it("ignores non-owner comments", () => {
    expect(listingHype(mk("owner", [{ voter_id: "x", body: "not hype", created_at: "2026-01-01" }]))).toBeNull();
  });
  it("returns null with no owner or no comments", () => {
    expect(listingHype(mk(null, [{ voter_id: "x", body: "y", created_at: "2026-01-01" }]))).toBeNull();
    expect(listingHype(mk("owner", []))).toBeNull();
  });
});
