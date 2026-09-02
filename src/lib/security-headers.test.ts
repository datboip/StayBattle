import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "./security-headers";

function csp(headers: { key: string; value: string }[]) {
  return headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
}
function hsts(headers: { key: string; value: string }[]) {
  return headers.find((h) => h.key === "Strict-Transport-Security");
}

describe("buildSecurityHeaders", () => {
  it("plain-http production (default self-host) must not upgrade requests or pin HSTS", () => {
    // Regression: a self-hosted `docker compose up` on http://192.168.x.x:3000
    // got every /_next/static asset rewritten to https:// by the browser and
    // the page never left "Loading…".
    const h = buildSecurityHeaders({ isProd: true, https: false });
    expect(csp(h)).not.toContain("upgrade-insecure-requests");
    expect(hsts(h)).toBeUndefined();
  });

  it("https production opts into upgrade-insecure-requests and HSTS", () => {
    const h = buildSecurityHeaders({ isProd: true, https: true });
    expect(csp(h)).toContain("upgrade-insecure-requests");
    expect(hsts(h)?.value).toBe("max-age=63072000; includeSubDomains");
  });

  it("production never allows unsafe-eval", () => {
    for (const https of [true, false]) {
      expect(csp(buildSecurityHeaders({ isProd: true, https }))).not.toContain("unsafe-eval");
    }
  });

  it("dev allows unsafe-eval for Turbopack HMR and never pins HSTS", () => {
    const h = buildSecurityHeaders({ isProd: false, https: true });
    expect(csp(h)).toContain("unsafe-eval");
    expect(hsts(h)).toBeUndefined();
  });

  it("always sends the baseline hardening headers", () => {
    const keys = buildSecurityHeaders({ isProd: true, https: false }).map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
    ]));
  });
});
