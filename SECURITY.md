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

## Takedown requests (DMCA, host opt-out, other)

StayBattle is a **decision-support tool for small private groups** — each
listing on the platform is one URL that someone in a group pasted into
their own private battle. It is not a search engine, not an aggregator,
not a directory; there is no "browse all listings" surface, no public
index, no bulk discovery. Each listing fetch is a single HTTPS request
made the moment a user adds the URL, against the public listing page
that anyone with the same URL can see logged-out.

We'll honor takedown requests anyway. The path:

### For property owners / hosts

If a listing you own appears on this platform and you'd like it removed:

1. Email the maintainer (see `LICENSE` / git log) with:
   - The Airbnb (or other) URL you want removed.
   - Proof of ownership (host display name visible on the listing
     page, plus your matching account email).
2. We'll remove the listing within 7 days and add the URL to a
   blocklist so it can't be re-added on the instance you contacted.
3. The instance is single-operator. If someone has forked this codebase
   under AGPL and is running their own copy, we can't take down what
   they show — you'd contact each operator separately. The AGPL license
   does not give us any control over forks.

### For DMCA notices

Same channel. Include the standard DMCA elements:

- Identification of the copyrighted work (a listing description, a
  photo, etc.).
- Identification of where the alleged infringement appears on the
  StayBattle instance.
- Your contact info.
- A statement of good-faith belief that the use is not authorized.
- A statement, under penalty of perjury, that you are authorized to
  act on behalf of the copyright owner.

We'll process and respond within the DMCA's 14-day window.

### Counter-notice / mistake

If you believe a takedown was made in error (e.g. the host opt-out
was sent by someone who isn't the host), reply on the same email
thread with what's wrong and we'll re-evaluate. We don't have a
formal appeals UI; this is a personal project, not a platform.

### How the takedown is implemented

The instance operator runs:

```bash
node scripts/admin/remove-url.mjs <url> "DMCA from <name> <date>"
```

This:

1. Deletes the listing row from the `listings` table (votes and
   comments cascade via foreign key).
2. Inserts the canonical URL into `blocked_urls`.
3. The `addListing` server action refuses any future re-add of that
   URL with a clear error message.

Past-battles archive snapshots aren't touched — those rows already
have the URL field scrubbed at archive time (see `PRIVACY.md`), so
nothing in the trophy case points at the live listing.

The blocklist is local to each StayBattle instance. Operators of
forks are not bound by our takedowns.

### What we won't do

- We won't disclose who paste-added a particular URL. The "added by"
  attribution is between the crew of one private battle.
- We won't pre-scan or filter URL submissions for copyright. The crew
  using one battle is responsible for what they paste into it, same
  as a Slack thread or group text.
- We won't honor "remove all listings in city X" or "block this
  domain entirely." Takedowns are per-URL.

## Data handling

StayBattle stores everything in a single local SQLite file (`./data/quickie.db`).

- **No analytics.** No tracking pixels. No third-party JavaScript.
- **No data egress** other than the explicit, scoped outbound calls listed in `README.md` (Airbnb scrape on add, Nominatim geocode on place pin, OSM tile fetches while map is open).
- **Deleting the `data/` folder** wipes all user data. No retention.

## Dependencies

- `npm audit` runs on every CI build via the standard `npm ci` install step.
- Dependabot is configured to open weekly PRs for npm and GitHub Actions updates (`.github/dependabot.yml`).
- The only network-effectful production dependencies are `better-sqlite3` (local), `cheerio` (HTML parsing of fetched pages), `leaflet`/`react-leaflet` (client-side map), and `next`/`react` (framework).
