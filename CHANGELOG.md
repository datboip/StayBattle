# Changelog

All notable changes to StayBattle. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are semver-flavored.

## [Unreleased]

### Changed
- **Voting is now a 1–5 slider** (Nope · Meh · OK · Like · Love) instead of thumb up / thumb down. Scores are now means in the 1.0–5.0 range; old `-1 / +1` rows are migrated to `1` / `5` on first boot.
- Roster sort modes are now **score · votes (count) · recent** — the old "raw upvotes" mode is gone.
- Brand book moved to a canonical URL at [staybattle.com/brand](https://staybattle.com/brand). The app subdomain redirects `/brand` to that page.

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
