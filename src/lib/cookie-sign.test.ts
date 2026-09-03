import { describe, expect, it } from "vitest";
import { signPayload, verifyPayload } from "./auth";

const SECRET = "test-secret-abc123";

describe("signPayload / verifyPayload", () => {
  it("round-trips a payload", () => {
    const p = JSON.stringify({ id: "u1", name: "Alex" });
    expect(verifyPayload(signPayload(p, SECRET), SECRET)).toBe(p);
  });
  it("rejects a tampered payload", () => {
    const signed = signPayload(JSON.stringify({ id: "u1", name: "Alex" }), SECRET);
    const [p64, sig] = signed.split(".");
    // swap the payload for an organizer id, keep the old signature
    const forgedP64 = Buffer.from(JSON.stringify({ id: "organizer", name: "x" })).toString("base64url");
    expect(verifyPayload(`${forgedP64}.${sig}`, SECRET)).toBeNull();
  });
  it("rejects a tampered signature", () => {
    const signed = signPayload("hello", SECRET);
    const [p64] = signed.split(".");
    expect(verifyPayload(`${p64}.deadbeef`, SECRET)).toBeNull();
  });
  it("rejects a different secret", () => {
    const signed = signPayload("hello", SECRET);
    expect(verifyPayload(signed, "other-secret")).toBeNull();
  });
  it("rejects malformed input", () => {
    expect(verifyPayload("no-dot-here", SECRET)).toBeNull();
    expect(verifyPayload("", SECRET)).toBeNull();
    expect(verifyPayload("a.b.c", SECRET)).toBeNull();
  });
});
