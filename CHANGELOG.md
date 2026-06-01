# Changelog

All notable changes to StayBattle. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are semver-flavored.

## [Unreleased]

## [0.4.1] — 2026-06-01

Pre-public-flip hardening pass. The big change here is closing an IDOR across every server action — the prior model trusted client-supplied voter IDs, which would have been a 30-second exploit once the source was readable. This release derives identity from the server-read cookie and ignores the body parameter for auth purposes.

### Security
- **Closed an IDOR across all state-mutating server actions** (`castVote`, `addComment`, `deleteComment`, `removeListing`, `kickParticipant`, `closeBattle`, `deletePastBattle`, `joinBattle`, `setBattleRequirements`, etc.). Every action now derives identity from `readVoterCookie()` via three helpers (`requireSelf` / `requireOrganizer` / `requireMember`) and ignores the client-supplied `voterId` for auth. Verified end-to-end via Playwright: spoofing another voter's UUID returns `"Sign in mismatch — please sign in again"`.
- **Voter cookie is now `httpOnly`.** XSS that exfils page state can no longer lift the session token.
- **Closed `deletePastBattle` auth bypass.** Previously when no active battle existed the check skipped entirely; now requires an active battle's organizer.
- **Rekeyed `joinBattle` rate-limit.** Per-voter throttle plus a per-battle ceiling so attackers rotating UUIDs can't brute the 6-char invite code.
- **CSP drops `unsafe-eval` in production** (was needed only for dev/Turbopack HMR). `Strict-Transport-Security` is now sent in production with a 2-year max-age + `includeSubDomains`. `upgrade-insecure-requests` added.
- **GraphQL photo URLs are host-validated** against an Airbnb CDN allowlist (`*.muscache.com`, `*.airbnbusercontent.com`) before being written to the DB — closes a future XSS surface if the upstream response ever drifts.
- **`SECURITY.md` now routes to GitHub Private Security Advisories** instead of "email the maintainer (see git log)" — git-log addresses were noreply aliases that don't deliver inbound mail.

### Added
- **Full photo album pull** via `HERO_DEFAULT` + `PHOTO_TOUR_SCROLLABLE_MODAL` sections in the existing GraphQL availability call. Typical jump from ~8 shots to 30-50, capped at 50 in the DB.
- **`docker.yml` publishes both `0.4.0` and `v0.4.0` tags** so the `STAYBATTLE_TAG=v0.4.0` form documented in `install.sh` actually resolves.

### Changed
- **Availability queue split-update.** On fetch error, only `availability_status` is bumped to `unknown` + `availability_checked_at` is refreshed; `price_display` / `amenities` / `cancellation_policy` / `unavailability_reason` are preserved. Previously a transient blip wiped cached metadata.
- **`scrape.ts` throws on `!res.ok`** instead of returning an empty-but-valid shape, so the caller can surface "HTTP 403" to the user instead of silently saving a broken row.
- **`EMPTY_RESULT` is now frozen + factory-wrapped.** Two of three error paths in `parseAvailabilityResponse` were returning the shared singleton by reference; downstream `push` onto `result.amenities` / `result.photos` would have mutated subsequent "empty" results.
- **`joinBattle` self-heals.** Sets the voter cookie inside the action so a client with localStorage identity but no cookie (e.g. carried over from before the auth migration) no longer loops forever on JoinGate auto-fire.

### Fixed
- **DNS hygiene**: deleted 5 Namecheap email-forwarding MX records + their orphan SPF (eliminates the registrar attribution leak), pointed `www` CNAME at the apex (was Namecheap parking page), added strict DMARC (`p=reject`).

## [0.4.0] — 2026-05-28

First versioned cut. Everything that landed between the initial `0.1.0` seed and the v0.4.0 tag is grouped here, plus the versioning + release-pipeline work itself.

### Added — versioning & release pipeline
- `package.json` now carries a real semver (`0.4.0`).
- Build-time version stamp: `scripts/build-version.mjs` generates `src/lib/version.ts` (gitignored) from `package.json` + `git rev-parse HEAD`, with `dirty` detection.
- Version surfaced in four places: page footer, Help modal "About this build" section, Demo modal subtitle, and `<meta name="staybattle-version">` in the document head.
- `/api/version` JSON endpoint for uptime checks and "is this still my build?" probes.
- GitHub Actions release workflow (`.github/workflows/release.yml`) that auto-creates a Release with CHANGELOG-extracted notes when a `v*` tag is pushed.
- `install.sh` accepts `STAYBATTLE_TAG=v0.4.0` to pin a specific image.

### Changed
- **Voting is now a 1–5 slider** (Nope · Meh · OK · Like · Love) instead of thumb up / thumb down. Scores are now means in the 1.0–5.0 range; old `-1 / +1` rows are migrated to `1` / `5` on first boot.
- Roster sort modes are now **score · votes (count) · recent** — the old "raw upvotes" mode is gone.
- Brand book moved to a canonical URL at [staybattle.com/brand](https://staybattle.com/brand). The app subdomain redirects `/brand` to that page.
- Public SSR is now gated server-side: anonymous visitors see only the join prompt + trophy case; no battle payload leaks via `curl /`.
- `FlashbangBanner` renamed to `DarkModeWarning` internally (UI copy unchanged).

### Added
- **Drop-a-pin** mode on the map: organizers and crew can click anywhere to add a reference place with a name, optional address, and optional URL — no geocoding required.
- **Status-colored map pins**: available (teal), booked (rose with ✕ overlay), unknown (amber).
- **Availability panel** for organizers: at-a-glance counts, soft recheck + force recheck with a confirm step, live "checking N of M…" progress, and a "+N newly booked" diff after the run completes.
- **BOOKED** rubber-stamp overlay covering the whole card (GTA WASTED-style) when a listing falls out of the running.
- **Column toggle** (Auto · 1 · 2 · 3) on the roster, with persistence to `localStorage` and SVG glyphs for each mode.
- LICENSE (AGPL-3.0-only), CONTRIBUTING.md, GitHub issue + PR templates, CI workflow.
- Rate limiting on server actions (per-IP token bucket, in-memory).
- Content Security Policy + security response headers in `next.config.ts`.
- Input length caps on names, comments, URLs, and place queries.
- Vitest test setup with unit tests for `scrape`, `geocode`, and `rank`.
- Dockerfile + `.dockerignore` for one-command self-hosting.
- Image lightbox: clicking a listing photo opens a full-screen viewer with arrow-key nav.
- Keyboard shortcuts in review mode: `1`–`5` set the rating directly, `↑`/`U` = 5 (Love), `↓`/`D` = 1 (Nope), `→`/space = next, `←` = previous, `Esc` = exit.

## [0.1.0] — initial

- Airbnb URL scraper (JSON-LD `VacationRental` block, OG meta tag fallback).
- Local SQLite store via `better-sqlite3`.
- Upvote / downvote with localStorage identity.
- Trash-talk comments per listing.
- Leaflet map showing listings + manually-pinned reference places.
- Nominatim geocoding with regional viewbox biasing.
- Dark "fight-night" theme with horizontal fighter-card roster layout.
- Clipboard auto-detect for Airbnb URLs.
