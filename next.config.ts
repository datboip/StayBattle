import type { NextConfig } from "next";

// Content Security Policy. Permissive enough for Leaflet + OSM tiles + Airbnb
// image CDN, restrictive on script sources. `unsafe-inline` for style is
// required because Tailwind 4 injects inline styles for things like aspect-ratio
// at runtime; remove it and a chunk of styles break.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next dev tools need unsafe-eval; tighten in prod if you patch the build
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.muscache.com https://*.airbnbusercontent.com https://*.tile.openstreetmap.org https://unpkg.com",
  "font-src 'self' data:",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), interest-cohort=()" },
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
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
