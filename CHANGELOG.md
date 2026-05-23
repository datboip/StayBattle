# Changelog

All notable changes to StayBattle. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are semver-flavored.

## [Unreleased]

### Added
- LICENSE (AGPL-3.0-only), CONTRIBUTING.md, GitHub issue + PR templates, CI workflow.
- Rate limiting on server actions (per-IP token bucket, in-memory).
- Content Security Policy + security response headers in `next.config.ts`.
- Input length caps on names, comments, URLs, and place queries.
- Vitest test setup with unit tests for `scrape`, `geocode`, and `rank`.
- Dockerfile + `.dockerignore` for one-command self-hosting.
- Sort toggle on the roster: by score, raw upvotes, or recency.
- Image lightbox: clicking a listing photo opens a full-screen viewer with arrow-key nav.
- Keyboard shortcuts: `/` focuses the URL input, `←`/`→` scroll the roster.

## [0.1.0] — initial

- Airbnb URL scraper (JSON-LD `VacationRental` block, OG meta tag fallback).
- Local SQLite store via `better-sqlite3`.
- Upvote / downvote with localStorage identity.
- Trash-talk comments per listing.
- Leaflet map showing listings + manually-pinned reference places.
- Nominatim geocoding with regional viewbox biasing.
- Dark "fight-night" theme with horizontal fighter-card roster layout.
- Clipboard auto-detect for Airbnb URLs.
