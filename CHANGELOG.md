# Changelog

All notable changes to StayBattle. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are semver-flavored.

## [Unreleased]

### Security
- **Voter cookie is now HMAC-signed.** It was unsigned JSON, and members receive the organizer's `voter_id` in the page payload — so a member could hand-edit the cookie to the organizer's id and take over the battle (close it, kick people, roll the invite code). The cookie is signed with a per-instance secret auto-generated and persisted in the data dir; a forged or tampered cookie is rejected. Existing sessions are invalidated once (everyone re-signs in).
- **Submission photos stay blind against members too.** During the submission phase the server sent every member the full listing objects (URLs, titles, coordinates, comments, submitter ids) and only hid them visually. Non-owned submissions now leave the server as `{ id, photos }` only; full detail is sent for your own submissions.
- **`castVote` / `addComment` require battle membership.** They checked identity but not membership or phase, and trusted the client-supplied display name. Votes now require the voting phase, both require membership, and both attribute to the authenticated name rather than whatever the client sends.

### Added
- **Availability now shows *why* a listing is booked.** The scraper already stored Airbnb's reason (e.g. "Minimum stay is 3 nights") but the badge only ever rendered a bare "booked". It now shows the specific reason inline and in the tooltip. The availability badge also appears on your own submission cards during submission, so a listing that fails your trip dates is caught before voting.
- **Hype shows as a pin on the teaser.** A submitter's one-liner (e.g. "Private pool!") now appears as a pushpin note on that listing's tile in the "Current submissions" teaser, so the crew sees the pitch while browsing. (Note: this surfaces each hype to members during the submission phase.)
- **Drive times are cached.** The listing×place OSRM matrix was recomputed on every 6-second render, which could blow past the public OSRM demo server's 1-request/second limit with a few active voters. A `route_durations` table now caches each pair (a route between two fixed points never changes), so OSRM is only called when a new listing or place adds an uncached pair.

### Changed
- **Teaser photo crossfade is gentler** (900ms → 1800ms) so cycling reads as a soft dissolve, not a flick.

### Fixed
- **Trophy-case delete button only shows for the organizer.** It rendered for any signed-in voter but the server rejected non-organizers, so it silently failed. Now gated to the current battle's organizer, matching the server.
- **Closed battles respect organizer availability overrides in the podium.** The trophy calc kept a listing if it had any override at all; a listing the organizer marked "booked" could still win. It now uses the override's direction (`availability_override_status`).
- **Listing cards show price and cancellation policy.** Both were scraped and stored but never rendered.
- **Airbnb UI icons no longer show up as listing photos.** The scrape's host-allowlist accepted any `muscache.com` URL, so Airbnb's own platform illustrations (`/im/pictures/airbnb-platform-assets/…` search-bar icons, the little-house and cartoon-person graphics) and host avatars leaked into the photo carousel. A stricter `isListingPhotoUrl()` now rejects those paths in both the GraphQL and HTML scrape paths; existing rows can be cleaned by re-scraping.
- **Submissions teaser: "Frozen" now stops the scroll.** It previously only froze each tile's photo rotation, leaving the marquee drifting — so in the scrolling view "Frozen" looked like it did nothing. It now halts the scroll too.
- **Submissions teaser: no more blank gap in the scrolling strip.** With few submissions a row was narrower than the screen and the wrap-around exposed an empty tile; rows now repeat enough to always fill the width.

## [0.4.3] — 2026-09-03

Setup-flow papercuts.

### Added
- **Check-in auto-advances to check-out.** Picking a check-in date now fills check-out with the next day (when it's empty or would fall on/before check-in) and opens its date picker, so setting a trip is one gesture instead of two disconnected fields. Shared `DateRangeFields` component used by both the new-battle form and the organizer's trip-dates bar; pure date math in `src/lib/dates.ts` with unit tests.

### Fixed
- **Sign out no longer needs a manual refresh.** `useVoter` is a per-component hook, so signing out in the header cleared its own copy but left the sign-in gate's separate copy stale until reload — you'd land on a dead form. It now broadcasts a same-tab auth-change event so every instance updates immediately.

## [0.4.2] — 2026-09-02

Patch release: un-bricks plain-http self-hosts.

### Fixed
- **Plain-http self-hosts were stuck on "Loading…".** v0.4.1 added `upgrade-insecure-requests` + HSTS to the production CSP unconditionally. Browsers honour the upgrade directive even on `http://` origins, so a LAN install at `http://192.168.x.x:3000` had every `/_next/static` chunk rewritten to `https://` and failing with `ERR_SSL_PROTOCOL_ERROR` — no JS ran, so the page never hydrated past the SSR "Loading…" fallback. Both directives are now opt-in via `STAYBATTLE_HTTPS=true` (a build-time flag / Docker build arg) for TLS-terminated deployments. Header logic moved to `src/lib/security-headers.ts` with vitest coverage.
- **Plain-http self-hosts answered "Sign in first" to every action.** The voter cookie was `secure: NODE_ENV === "production"`; browsers drop Secure cookies on any non-localhost http origin, so at `http://192.168.x.x:3000` sign-in stuck client-side but the server never saw a session — "Start the battle", voting, everything refused. `Secure` is now gated on the same `STAYBATTLE_HTTPS=true` flag (read at run time; the Dockerfile carries it into the runtime stage). Cookie attributes moved to a tested `voterCookieOptions()` helper.
- **Public demo showed "checking…" on every listing forever.** `scripts/admin/reset-demo.mjs` wiped the whole `settings` table, which dropped the `availability_reset_v1` flag that `db.ts` checks at boot — so the next container restart re-ran the one-shot availability wipe and nulled every status the reset had just baked. The reset now re-arms the flag inside its own transaction. Integration test runs the real script against a temp DB.
- **Demo mode no longer scrapes Airbnb.** `addListing` was not demo-gated, so any visitor could make the public demo fetch `airbnb.com` (README had claimed the scrape was skipped). `addListing` and `refreshAvailability` now refuse up front in `STAYBATTLE_DEMO_MODE` with a message saying why.
- **Re-check buttons surface refusals.** Both `AvailabilityPanel` and the `BattleHeader` "recheck all dates" button ignored the action result, so a refused recheck (demo mode, missing trip dates) either showed "checking 0 of N…" until a timeout or silently did nothing. Both now show the error inline.
- **"New code" / "Kick" silently did nothing on refusal.** `InviteCodePanel` ignored the action result, so an expired session or a non-organizer cookie made the confirm dialog close with no visible effect. Refusals now render inline.
- **Demo modal header was a black smear in light mode.** Its `bg-gradient-to-br … via-zinc-950` gradient wasn't covered by the light-theme surface remap (which can't reach gradient stops). Tagged with the existing `.sb-deep-surface` helper so it swaps like the other dark gradient surfaces.

### Added
- **Stale battles archive themselves.** A battle whose check-out day ended more than 7 days ago is moved to the trophy case on the next page load, exactly as the organizer's "close battle" does (listings, pins, participants, and trip dates cleared). Before, a trip that ended months ago blocked the whole one-battle-per-server instance until its organizer signed in with their PIN. Battles with no dates never go stale. `isStale()` in `src/lib/battle.ts` (unit-tested) + a shared `closeCurrentBattle()` in `battle-server.ts` used by both paths (DB-level test).

### Changed
- **Demo discloses what is simulated.** Sign-in screen gets a "Public demo" hint (anonymous visitors never saw the demo modal), the demo modal explains that badges / votes / comments are seed data, and the footer disclaimer has a demo-mode variant instead of claiming badges were "scraped from Airbnb's public page".
- `vitest.config.ts` aliases the `server-only` marker package so server-action modules can be imported in tests.

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
