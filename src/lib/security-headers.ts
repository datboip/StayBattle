// Security headers shared by next.config.ts. Kept in src/ so vitest can cover
// the plain-http vs https branching — a regression here bricks every
// self-hosted install (see security-headers.test.ts).
//
// Content Security Policy. Permissive enough for Leaflet + OSM tiles + Airbnb
// image CDN, restrictive on script sources. `unsafe-inline` for style is
// required because Tailwind 4 injects inline styles for things like aspect-ratio
// at runtime; remove it and a chunk of styles break.
//
// `unsafe-eval` is required by Next's dev/HMR pipeline (Turbopack uses it for
// hot module replacement) but is NOT needed in production builds. We keep it
// only when NODE_ENV !== "production".
//
// `unsafe-inline` for scripts is still present here as a pragmatic stop-gap.
// The proper fix is nonce-based CSP — a `next/middleware` step that mints a
// per-request nonce and a render-time hook that attaches it to every inline
// <script>. That's a follow-up; the current header is no worse than what
// shipped pre-v0.4.0.
//
// `upgrade-insecure-requests` and `Strict-Transport-Security` are only correct
// when the app is actually served over TLS. On a plain-http self-host
// (http://192.168.x.x:3000 via `docker compose up`) the browser would rewrite
// every /_next/static asset to https://, fail with ERR_SSL_PROTOCOL_ERROR, and
// the page would never leave "Loading…". They are therefore opt-in via
// STAYBATTLE_HTTPS=true, which the TLS-terminated public deployment sets.

export type SecurityHeader = { key: string; value: string };

export function buildSecurityHeaders(opts: {
  isProd: boolean;
  https: boolean;
}): SecurityHeader[] {
  const { isProd, https } = opts;
  const tls = isProd && https;

  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.muscache.com https://*.airbnbusercontent.com https://*.tile.openstreetmap.org https://unpkg.com",
    "font-src 'self' data:",
    "connect-src 'self' https://nominatim.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(tls ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "geolocation=(), microphone=(), camera=(), interest-cohort=()",
    },
    // Two-year HSTS with subdomain coverage. Only when TLS-terminated so a
    // plain-http install (or dev over localhost) isn't permanently pinned.
    ...(tls
      ? [{
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        }]
      : []),
  ];
}
