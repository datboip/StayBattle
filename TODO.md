# StayBattle · future ideas

Not promises, just a parking lot. Roughly ordered by "obvious next" → "nice to have."

## Listing data we could scrape but currently don't

Everything below is in the **deferred-state JSON blob** we already fetch in
`src/lib/scrape.ts` — it's a giant `<script>` tag with a JSON payload that
Airbnb hydrates the page from. We're only mining the `VacationRental`
JSON-LD island today. The deferred state has a lot more.

Implementation sketch: add a `parseDeferredState(html)` helper next to
`collectJsonLd`. Pull out:

- ~~**Amenities** → array of `{ groupName, items: [{ title, available }] }`.~~
  **DONE** — mined from the same Airbnb GraphQL call that backs availability;
  stored as `listings.amenities` JSON, parsed on read (see `types.ts:35`).
  Curated subset via `AMENITY_TAGS` in `airbnb-graphql.ts`.
- **House rules** → pets / smoking / parties / events / quiet hours / check-in
  window. Section id `POLICIES_DEFAULT` or similar.
- **Cancellation policy** → flexible / moderate / strict / super-strict, plus
  free-cancellation cutoff date.
- **Property type** → "Entire villa" / "Private room" / etc.
- **Host info** → superhost boolean, years hosting, response time. Skip
  response rate / response time for privacy unless explicitly wanted.
- **Description** → the "About this place" prose.
- **Safety** → smoke alarm, CO alarm, first aid, security camera disclosure.
- **Check-in style** → self check-in / lockbox / smart lock / keypad / host
  greets you.

## Prebooking-setup checklist (the user-facing piece)

**Hard requirements: DONE.** Organizer toggles must-have amenities from a
chip picker (`RequirementsPanel`, collapsed by default). Each listing
card renders a "Must-haves" row: ✓ "All met" when satisfied, otherwise
"Missing: Wifi, Parking" in red. Backed by `settings(key='battle_requirements')`
holding the JSON array; helpers + 12 tests live in `src/lib/requirements.ts`.

Still open:

- **Soft preferences** (would-be-nice tags) that nudge the score
  without disqualifying. Schema is forward-compatible — the stored
  JSON could carry `{ tag, hard: boolean }` instead of plain strings
  without a migration.
- **Free-text custom requirements** alongside the curated picker. Right
  now you're limited to the 23 AMENITY_TAGS the scraper recognizes.
- **Score weighting**: today must-haves are purely informational. A
  small score penalty for each missing must-have would let the
  ranking surface naturally fall in line with the organizer's
  must-haves.

## Multi-source URL support

Today the URL parser only handles Airbnb URLs. Long-term idea: detect
the source platform from the pasted URL and route to the matching
scraper. No commitments on which platforms or when — this is parking-
lot territory until there's actual demand.

## Expand reference places → "things to do" / "places of interest"

`places` started as an organizer-only list of pinned reference dots; the
recent drop-a-pin work made it crew-wide. Expand the rest of the way into
a real "argument-settler" layer.

- ~~**Anyone can submit**~~ — **DONE.** Drop-a-pin mode lets any signed-in
  voter click the map to add a place with name, optional address, optional
  URL. `addPlaceAtCoords` in `actions.ts` skips geocoding (lat/lng come
  straight from the click).
- ~~**Categorize**: theme park, restaurant, beach, museum, bar, airport,
  grocery, etc.~~ — **DONE.** Curated 10-category set lives in
  `src/lib/place-categories.ts` (theme-park · restaurant · bar · beach ·
  museum · airport · grocery · nature · shopping · other). Drop-pin form
  shows a chip-row picker; markers render as color-coded dots with the
  category emoji centered. Legacy `kind = "reference"` rows fall back
  to the "Other" category in the UI without a migration.
  - **Still open:** free-text category alongside the curated picker, if
    someone wants a niche tag the curated set doesn't cover.
- **Notes field** — "this is the one with the good sushi", "kids loved
  this last time", etc. Drop-pin form already has a `url` slot; a free-
  text note would be the natural next field.
- ~~**Per-listing distance summary**~~ — **DONE.** Each card shows a
  "Nearby" pill row with the 3 closest pinned places (any category)
  under 100km. v1 used straight-line haversine; v2 (current) calls
  OSRM at `router.project-osrm.org` per SSR for the full listings ×
  places matrix and renders **drive time** ("🎢 Magic Kingdom 12min")
  instead of km. Falls back to haversine display on OSRM failure /
  unreachable / null pairs so the row never disappears. Tooltip on
  drive-time pills includes the crow's flight km for the curious.
  - **Still open:** persistent cache table (`route_durations`) so
    repeated SSRs don't re-hit OSRM. Right now the v1 OSRM call adds
    ~500ms-1s to first-render latency on a battle with many
    listings × places. Cloudflare in front absorbs subsequent loads.
  - **Still open:** point `STAYBATTLE_OSRM_URL` at a self-hosted OSRM
    when traffic outgrows the public demo's rate limits.
- ~~**Map filter chips**~~ — **DONE.** Bottom-left of the map, a chip
  per category that has ≥1 pin (so a 3-category map doesn't show 10
  chips). Tap to hide that category; line-through + dimmed text signals
  the hidden state. Persists to `localStorage` under `sb-map-hidden-kinds`.
- ~~**No scraping at all**~~ — **DONE / by-design.** Drop-pin is pure
  user input; no Nominatim call required for placement.
- ~~**Light dedup**~~ — **DONE.** `addPlaceAtCoords` runs a bounding-box +
  haversine check against existing pins on insert. Same normalized name
  (case + punctuation + whitespace folded) within ~50m → contributor
  appended to `added_by_name` ("Alice, Bob, Carol") and no duplicate row
  inserted. Different name within 50m still allowed (strip-mall case).
  Pure helpers + 13 unit tests in `src/lib/place-dedup.ts`.

The reason this is good: vacation arguments are rarely about *which*
listing per se — they're about *where the trip should be anchored*. A map
with both candidate listings AND the agreed-on must-visit places lets the
group reason visually about commute pain, which usually settles it faster
than discussing in the abstract.

## Demo media for the README

**DONE** — 13 screenshots committed in `docs/screenshots/`, regenerated
by `scripts/screenshots/seed-demo.mjs` + `scripts/screenshots/capture.mjs`
against a sandboxed `data-demo/quickie.db` so no real names/places leak.
Covered: sign-in (desktop + mobile), battle header, voting grid (desktop +
mobile), review mode (+ 3 frames for a swipe loop), map, trophy case,
comments expanded.

Still open:

- **Submission-phase view** — capture script currently skips it because
  the seeded demo battle is in voting phase. Either seed a second
  submission-phase battle or drop the capture step (form is small enough
  to not need a hero shot).
- **GIF / screencap** (10–15s) — paste URL → card appears → rate → comment →
  see it climb. Still aspirational; Playwright `video` recording is the
  easiest path if we want this.

## Marketing site

**DONE** — live at [staybattle.com](https://staybattle.com); brand
book at [staybattle.com/brand](https://staybattle.com/brand).

## Back up the SQLite DB when flipping to real production

**On-box backups: DONE.** The marketing-site repo's `infra/` now ships:

- `backup-db.sh` — `sqlite3 .backup` (consistent against in-flight writes)
  into `/var/lib/staybattle/backups/quickie-<ISO timestamp>.db`. Retains
  the 30 most recent by default (override via `STAYBATTLE_BACKUP_RETAIN`).
- `staybattle-backup.service` — systemd oneshot that runs the script.
- `staybattle-backup.timer` — daily 03:15 UTC trigger with
  `Persistent=true` so a stretch of downtime catches up on next boot.

Enable + restore-drill instructions live in `staybattle-site/infra/DEPLOY.md`.

**Still open (do BEFORE flipping `STAYBATTLE_DEMO_MODE=false`):**

- **Off-box destination** — same-box backups don't survive disk failure.
  Pick one and wire it into `backup-db.sh` after the snapshot line
  (script echoes the path to stdout for exactly this):
  - `aws s3 cp "$OUT" s3://staybattle-backups/`
  - `rclone copy "$OUT" cloudflare-r2:staybattle-backups/`
  - `scp "$OUT" backup-host:/srv/staybattle/`
- **Quarterly restore drill** — pull the latest snapshot to a scratch
  box, `STAYBATTLE_DB_DIR=/tmp npm run dev`, verify schema + UI. Drill
  steps in DEPLOY.md.

## Public-instance hardening

Shipped: per-IP rate limits at nginx, operator URL takedown tool
(`scripts/admin/remove-url.mjs`), DMCA / opt-out procedure documented
in [SECURITY.md](SECURITY.md), and TOS / PRIVACY docs.

Hardening that's only load-bearing if the project ever grows beyond
friends-and-family use (no concrete plans):

- Multi-tenant schema (one-battle-per-server today).
- Signup-friction beyond per-name rate limit (captcha / email gate).
- Scrape dedup across battles to lower bandwidth.
- Moderation inbox + flag/ban workflow.
- Lawyer review of TOS / PRIVACY before any commercial use.

## Other ideas

- **Price snapshot on demand** — a one-shot "fetch a price" button (organizer
  only, rate-limited) that hits Airbnb's pricing endpoint with the trip
  dates. Caches for 24h. Helps the group sanity-check totals before voting.
- **Side-by-side compare** — pick 2-3 finalists, show photos + amenities +
  must-haves diff side by side.
- **Distance to a pinned place** — for each manually-pinned reference place
  on the map, compute travel time / straight-line distance to each listing.
- **Per-voter rankings** — instead of (or alongside) the existing 1–5
  slider, let each voter drag their top 5 into order. Combine via Borda
  count or Condorcet for a more nuanced "winner."
- ~~**Block self-vote on submitted listings**~~ — **DONE.** Server check in
  `castVote` returns `Can't rate your own listing`; UI guards in
  `VoteButtons` and `ReviewMode` swap the slider for a "You added this
  one · can't rate your own submission" note when the signed-in voter's
  id matches `listing.added_by_id`.
  - **Refinement still open:** if a voter submitted 4+ listings, allow
    them to vote on their own. Rationale: a heavy submitter has multiple
    horses in the race and should be able to differentiate favorites
    among them. Threshold (4? 3? configurable per battle?) is
    bikeshed-able. Probably overengineering — keep simple until someone
    actually complains.
- **"Why I voted X" prompt** — small text field that appears after voting,
  so the group sees reasoning, not just numbers.
- **Calendar export** — once a winner is picked, generate an .ics with the
  trip dates and a link to the listing.

## Privacy / threat model

Full threat-model details, what we protect against, what's still
open, and the mitigations live in [PRIVACY.md](PRIVACY.md). That's
the canonical doc — this entry exists so the parking-lot reader knows
where to look.

Open privacy work that hasn't shipped yet:

- "Obscure my display name" voter setting (opt-in pseudonym).
- Share-preview UI that shows the organizer what a recipient sees
  before they copy the invite link.
- Auto-redact / organizer-scrub for old comments on archived battles.

## Availability detection improvements

(Tracked separately as the work goes — see `src/lib/availability.ts`.)
The static-HTML check is ~80–85% accurate. Real eligibility happens
client-side via GraphQL. Footer + badge already disclaim this. A
deeper fix would be hitting Airbnb's GraphQL endpoint directly with
the trip dates + guest count, but that's a brittle path Airbnb actively
churns. The override system + "Verify on Airbnb" call-to-action are the
practical workaround.
