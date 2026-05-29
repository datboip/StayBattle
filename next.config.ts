import type { NextConfig } from "next";

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
const isProd = process.env.NODE_ENV === "production";

const commonCspTail = [
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.muscache.com https://*.airbnbusercontent.com https://*.tile.openstreetmap.org https://unpkg.com",
  "font-src 'self' data:",
  ...commonCspTail,
].join("; ");

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), interest-cohort=()" },
  // Two-year HSTS with subdomain coverage. Only sent in production so dev
  // over plain http://localhost isn't permanently pinned.
  ...(isProd
    ? [{
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      }]
    : []),
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...baseSecurityHeaders,
];

// LAN access in dev: any host listed in NEXT_ALLOWED_DEV_ORIGINS (comma-separated)
// plus the standard RFC1918 private ranges so phones/laptops on your Wi-Fi can
// reach the dev server. Add your specific machine's hostname if you need it.
const allowedDevOrigins = [
  ...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
  "*.local",
  "192.168.*.*",
  "10.*.*.*",
  "172.16.*.*",
  "172.17.*.*",
  "172.18.*.*",
  "172.19.*.*",
  "172.20.*.*",
  "172.21.*.*",
  "172.22.*.*",
  "172.23.*.*",
  "172.24.*.*",
  "172.25.*.*",
  "172.26.*.*",
  "172.27.*.*",
  "172.28.*.*",
  "172.29.*.*",
  "172.30.*.*",
  "172.31.*.*",
  // Cloudflare quick tunnels — random *.trycloudflare.com subdomains.
  "*.trycloudflare.com",
  // ngrok subdomains, for users who prefer ngrok over cloudflared.
  "*.ngrok-free.app",
  "*.ngrok.app",
  "*.ngrok.io",
  // tailscale magic DNS.
  "*.ts.net",
  "*.tailscale.net",
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.muscache.com" },
      { protocol: "https", hostname: "**.airbnbusercontent.com" },
    ],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
  // /brand used to live in public/brand/index.html as a duplicate of the
  // marketing-site brand book. Now the marketing site at staybattle.com/brand
  // is the canonical brand surface — nginx redirects app.staybattle.com/brand
  // to it, and the app repo carries a docs/BRAND.md summary instead.
};

export default nextConfig;
