# Security policy

## What this app protects against

StayBattle is designed for **small trusted groups** (5–10 friends sharing one URL). With that scoped:

- **All SQL** is parameterized via `better-sqlite3` prepared statements. No string concatenation, no SQL injection surface.
- **All rendered user content** flows through React's auto-escaping. No raw-HTML sinks consume user input. The single Leaflet `divIcon` uses static markup only — annotated to warn against future interpolation.
- **Server actions are rate-limited** per actor with an in-memory token bucket (`src/lib/rate-limit.ts`). Sign-in, voting, commenting, listing-add, and place-add are all capped.
- **URL host validation** for Airbnb URLs uses an allow-list (`src/lib/validate.ts`), not regex matching — prevents `airbnb.com.attacker.com`-style bypasses.
- **PINs are hashed** server-side with `scrypt` (N=16384) and a per-voter random salt. A correct PIN takes ~100ms to verify; brute-forcing a 6-digit PIN at that rate takes ~14 hours of dedicated CPU, and is further slowed by a per-name attempt rate limit (5/min).
- **Security headers** (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) are set in `next.config.ts`.
- **Input sanitization** strips control characters and zero-width spaces, and caps length on every field.

## What this app does NOT protect against

- **A determined attacker who already has the URL.** Identity is name + 4–6 digit PIN. A 4-digit PIN has only 10,000 possibilities; rate-limiting helps but isn't bulletproof.
- **A malicious group member.** Once someone has a valid (name, PIN), they can vote, comment, add listings, and delete listings as themselves. Removal of listings is not authorized.
- **Public exposure.** If you put this on a public URL, randos can register names and pollute your roster. Use tailscale, a VPN, ngrok with a basic-auth proxy, or some other layer.

## Threat model assumptions

1. The deployment URL is private (LAN, tailscale, ngrok, or a small VPS that's not advertised).
2. All users in the group are mutually-trusted humans.
3. The host machine is trusted — anyone with shell access has full control of the SQLite file.
4. Network traffic between users and the server is over HTTPS (true for ngrok, tailscale; bring your own TLS if you self-host on a VPS).

If any of these don't hold for you, lock it down further before sharing the URL.

## Reporting a vulnerability

If you find a security issue:

- **Don't open a public GitHub issue.** Email the maintainer directly (see git log).
- A "security issue" here means something that could affect *other* StayBattle deployments running this code — not your own self-hosted instance, which you can patch yourself.

We'll triage and respond within a few days. There's no bug bounty — this is a personal project.

## Data handling

StayBattle stores everything in a single local SQLite file (`./data/quickie.db`).

- **No analytics.** No tracking pixels. No third-party JavaScript.
- **No data egress** other than the explicit, scoped outbound calls listed in `README.md` (Airbnb scrape on add, Nominatim geocode on place pin, OSM tile fetches while map is open).
- **Deleting the `data/` folder** wipes all user data. No retention.

## Dependencies

- `npm audit` runs on every CI build via the standard `npm ci` install step.
- Dependabot is configured to open weekly PRs for npm and GitHub Actions updates (`.github/dependabot.yml`).
- The only network-effectful production dependencies are `better-sqlite3` (local), `cheerio` (HTML parsing of fetched pages), `leaflet`/`react-leaflet` (client-side map), and `next`/`react` (framework).
