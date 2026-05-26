import type { NextConfig } from "next";

// Content Security Policy. Permissive enough for Leaflet + OSM tiles + Airbnb
// image CDN, restrictive on script sources. `unsafe-inline` for style is
// required because Tailwind 4 injects inline styles for things like aspect-ratio
// at runtime; remove it and a chunk of styles break.
const commonCspTail = [
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next dev tools need unsafe-eval; tighten in prod if you patch the build
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.muscache.com https://*.airbnbusercontent.com https://*.tile.openstreetmap.org https://unpkg.com",
  "font-src 'self' data:",
  ...commonCspTail,
].join("; ");

// /brand serves the static brand book HTML which links to Google Fonts. Relax
// style-src and font-src for that route only so IBM Plex / Black Ops One can
// load. The rest of the app uses next/font and keeps the strict CSP above.
const brandCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  ...commonCspTail,
].join("; ");

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), interest-cohort=()" },
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...baseSecurityHeaders,
];

const brandSecurityHeaders = [
  { key: "Content-Security-Policy", value: brandCsp },
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
      // Route-specific overrides go AFTER the catch-all — Next.js merges header
      // rules in order and the last matching value wins for duplicate keys.
      { source: "/brand", headers: brandSecurityHeaders },
      { source: "/brand/:path*", headers: brandSecurityHeaders },
    ];
  },
  async rewrites() {
    return [
      { source: "/brand", destination: "/brand/index.html" },
      { source: "/brand/", destination: "/brand/index.html" },
    ];
  },
};

export default nextConfig;
