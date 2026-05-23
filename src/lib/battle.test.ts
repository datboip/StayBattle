import { describe, expect, it } from "vitest";
import {
  deadlinePassed,
  effectivePhase,
  formatDeadlineCountdown,
  type Battle,
} from "./battle";

function mk(partial: Partial<Battle> = {}): Battle {
  return {
    id: "b1",
    name: "Test trip",
    organizer_id: "u1",
    organizer_name: "Alex",
    check_in: "2030-08-11",
    check_out: "2030-08-15",
    submission_deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
    phase: "submission",
    invite_code: "TEST00",
    created_at: new Date().toISOString(),
    started_at: null,
    ...partial,
  };
}

describe("deadlinePassed", () => {
  it("false when deadline is in the future", () => {
    expect(deadlinePassed(mk())).toBe(false);
  });
  it("true when deadline is in the past", () => {
    expect(
      deadlinePassed(
        mk({
          submission_deadline: new Date(Date.now() - 60_000).toISOString(),
        }),
      ),
    ).toBe(true);
  });
});

describe("effectivePhase", () => {
  it("returns submission while deadline is in the future", () => {
    expect(effectivePhase(mk())).toBe("submission");
  });
  it("flips submission → voting once the deadline has passed", () => {
    expect(
      effectivePhase(
        mk({
          submission_deadline: new Date(Date.now() - 60_000).toISOString(),
        }),
      ),
    ).toBe("voting");
  });
  it("leaves voting and closed phases alone", () => {
    expect(effectivePhase(mk({ phase: "voting" }))).toBe("voting");
    expect(effectivePhase(mk({ phase: "closed" }))).toBe("closed");
  });
});

describe("formatDeadlineCountdown", () => {
  const NOW = new Date("2030-08-01T12:00:00Z").getTime();
  it("formats days", () => {
    const b = mk({ submission_deadline: "2030-08-04T12:00:00Z" });
    expect(formatDeadlineCountdown(b, NOW)).toMatch(/3 days left/);
  });
  it("formats hours under a day", () => {
    const b = mk({ submission_deadline: "2030-08-01T18:30:00Z" });
    expect(formatDeadlineCountdown(b, NOW)).toBe("6h 30m left");
  });
  it("says deadline passed when negative", () => {
    const b = mk({ submission_deadline: "2030-08-01T11:00:00Z" });
    expect(formatDeadlineCountdown(b, NOW)).toBe("deadline passed");
  });
});
