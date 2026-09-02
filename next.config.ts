import type { NextConfig } from "next";

import { buildSecurityHeaders } from "./src/lib/security-headers";

// CSP + hardening headers live in src/lib/security-headers.ts (tested).
// STAYBATTLE_HTTPS=true opts into the TLS-only directives
// (upgrade-insecure-requests, HSTS). It is read at BUILD time — next.config
// headers are baked into the routes manifest — so set it for `next build` /
// as a Docker build arg, not just at `next start`.
const isProd = process.env.NODE_ENV === "production";
const securityHeaders = buildSecurityHeaders({
  isProd,
  https: process.env.STAYBATTLE_HTTPS === "true",
});

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
  // Strip the `X-Powered-By: Next.js` header from every response. Pure
  // fingerprinting freebie otherwise — anyone scanning the internet for
  // Next deployments to target with a Next-specific exploit gets a "yep,
  // this one" answer for free. Modern Next omits it by default in some
  // versions; making it explicit keeps the protection across upgrades.
  poweredByHeader: false,
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
