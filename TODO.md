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

Once we have amenities, build a per-battle "must-haves" list:

- Organizer (or anyone with edit rights) sets requirements: `wifi`, `pool`,
  `pet-friendly`, `EV charger`, `washer/dryer`, `parking`, `air-conditioning`,
  etc. Free-text plus a curated picker so it stays consistent.
- Each listing card shows a tiny green-check / red-x row against the
  must-haves so the group sees at a glance which ones miss a requirement.
- Optional "soft" preferences (e.g. "would be nice if it had a hot tub") that
  affect score weighting but aren't disqualifying.
- Mismatches don't hide the listing (people may still want to vote on it),
  they just add a "missing: hot tub, EV charger" line.

## Multi-source URL support — be a real aggregator

Right now we only accept Airbnb URLs. Airbnb's own Collaborative Wishlists
shipped voting in 2024 but is single-platform, account-gated, and reportedly
buggy (greyed-out vote controls; zero feature improvements across the
'24/'25/'26 release cycles). Their own 2024 launch deck admitted only 1%
of group bookings used shared wishlists. **their group-booking effort has stagnated.** Our
defensible angle is being the rare cross-platform group-voting tool.

Each platform sketch (rough effort estimate in `()`):

- ******* `(~3h)` — Expedia-owned, big "whole house" inventory Airbnb
  doesn't carry. JSON-LD VacationRental block is mostly there. Similar
  scrape pipeline to what we have. No date-availability without GraphQL
  but same disclaimer + verify-on-*** CTA pattern works.
- ******* `(~4h)` — Strong JSON-LD presence, but
  anti-bot is more aggressive than Airbnb. Test single requests first.
  Vacation rentals are alongside hotels — need a filter so we don't
  accept hotel URLs.
- **[***](https://www.***.com/)** `(~3h)` — Actually used by the
  maintainer (datboip), so this is the first crypto-friendly platform
  worth wiring up. Big inventory (~3M+ properties / hotels), pays in
  crypto + fiat, has an affiliate program, JSON-LD on listing pages.
  Start here for the crypto-platform support since we have a real user
  who'd use it from day one.
- **Other crypto / Web3 rental platforms** `(~varies)` — ***,
  ***, ***, Roam. **Friendliest legal posture of any
  source** — most have public APIs because they're building network
  effects, not protecting moats. Some are on-chain so the data is
  public by design. **This is worth considering.**
  Probably worth doing before ***.
- **Detection** — paste a URL, sniff which platform it's from, route
  to the right scraper. The platform shows as a small badge on the
  card so voters know "this one's from ***, that one's from
  ***, that one's from Airbnb."

### Legal aggregator framing

We're non-commercial, we link voters back to the source on every card,
we don't store images for re-distribution (we hot-link), and we don't
monetize. That's the same posture price-comparison aggregators
(Kayak, Trivago, Skyscanner) have used for years. Per the research
done in 2030-08-02, the post-`hiQ` + `Meta v. Bright Data` +
`X Corp v. Bright Data` legal landscape protects logged-out
personal-scale scraping of public pages. We never log in. The
worst realistic outcome is a C&D letter + IP block, never a lawsuit.

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
- **Per-listing distance summary** — for each booking candidate, show "8min
  to SeaWorld · 25min to Epcot · 3min to closest grocery." Straight-line
  distance is fine for v1; OSRM / Valhalla routing for v2 if anyone cares.
- ~~**Map filter chips**~~ — **DONE.** Bottom-left of the map, a chip
  per category that has ≥1 pin (so a 3-category map doesn't show 10
  chips). Tap to hide that category; line-through + dimmed text signals
  the hidden state. Persists to `localStorage` under `sb-map-hidden-kinds`.
- ~~**No scraping at all**~~ — **DONE / by-design.** Drop-pin is pure
  user input; no Nominatim call required for placement.
- **Light dedup** — if two people drop a pin within ~50m of the same name,
  merge them. Show "added by Alice, Bob" so the group sees consensus.

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

**DONE** — live at [staybattle.com](https://staybattle.com), separate
repo at [`datboip/staybattle-site`](https://github.com/datboip/staybattle-site),
plain HTML (not Astro, didn't need the toolchain). Symlinks the app
repo's `docs/screenshots/` into `/screenshots/` on the VPS so a screenshot
regen + `git push` on the app repo automatically refreshes the marketing
visuals on next pull. Brand book mounted at `staybattle.com/brand`.

## Back up the SQLite DB when flipping to real production

Right now the live VPS deployment runs with `STAYBATTLE_DEMO_MODE=true`
(see `staybattle-site/infra/staybattle.service`). Everything in
`/var/lib/staybattle/quickie.db` is reseedable from
`scripts/screenshots/seed-demo.mjs` — zero data-loss risk if the disk dies.

The moment that env flag flips to false and real users start submitting
listings and casting votes, the DB becomes precious. Before that
happens, set up:

- Daily cron `cp /var/lib/staybattle/quickie.db /backups/quickie-$(date +%Y%m%d).db`
  with a `sqlite3 .backup` command so it's safe against in-flight writes,
  not just a raw file copy.
- Off-box destination — Cloudflare R2, S3, or even a `scp` to a separate
  machine. The whole point is "if the VPS disk dies, we still have the
  votes." Same-box backups don't qualify.
- Retention policy — 30 daily snapshots, ~30 × ~few-MB = trivial cost.
- Restore drill — once a quarter, pull the latest snapshot to a scratch
  box and verify the schema migrations + a sample query still work.

Currently no urgency. Capture this here so the moment we have a real
user, this isn't a fire drill.

## Other ideas

- **Price snapshot on demand** — a one-shot "fetch a price" button (organizer
  only, rate-limited) that hits Airbnb's pricing endpoint with the trip
  dates. Caches for 24h. Helps the group sanity-check totals before voting.
- **Side-by-side compare** — pick 2-3 finalists, show photos + amenities +
  must-haves diff side by side. Like Trulia's compare-homes view.
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

## Privacy / threat model — the doxxing question

When you share a StayBattle link with the crew, you're handing them
(and anyone they forward to) a fairly detailed picture of your life:
**where** you'll be (listing addresses + map pins), **when** (trip
dates), **who** you're with (voter names + comments), and your
**spending range** (price-tier listings you've considered). For a
small private trip among real friends this is fine. The risk surface
gets sharper when:

- The link leaks beyond the intended crew (friend forwards it,
  someone screenshares, link gets crawled by a tunnel-provider's
  index, etc.).
- A voter's display name is their real name (most people use it).
- The cloudflared / ngrok URL is brute-forceable (random subdomain
  is usually safe-enough, but `*.trycloudflare.com` is a known
  high-traffic suffix some scanners crawl).

### What we already do

- Invite-code gate before any battle data is shown
- scrypt-hashed PINs (server-side, never plain-text)
- All data lives in local SQLite, no cloud upload
- No analytics, no telemetry, no third-party JS
- HTTP security headers (CSP, Referrer-Policy, etc.) so embedded
  pages can't snoop
- Photo hot-linking from Airbnb's CDN (we never store / proxy them
  in a way that could be enumerated)

### What's still soft

- **Tunnel-URL discoverability** — `*.trycloudflare.com` is on
  Cloudflare's wildcard cert which is logged in CT logs. Anyone
  scraping CT logs can find the subdomain exists; without the invite
  code they still can't see content. Mitigation: encourage users to
  use named cloudflared tunnels with a custom domain instead of
  quick tunnels for anything not throwaway.
- **Voter names** — `"Jenny Smith"` is a much bigger leak than
  `"Jenny"`. We don't enforce first-name-only, just suggest it.
  Could add an opt-in "obscure my display name as 'voter-#7'" mode
  for the paranoid.
- **Trip dates + addresses combination** — anyone who sees the page
  knows exactly when the house is empty. Mitigation: post-decision,
  archive the battle to trophy case and remove the addresses (we
  keep titles + photos but strip lat/lng + the specific URL after
  the trip is over). Currently we preserve everything.
- **Browser cache + history** — the URL ends up in browser history
  + autocomplete on every voter's machine. Mitigation: shorter,
  less-recognisable invite tokens (we already do 6-char codes;
  could rotate per-session).
- **The trophy case is permanent** — once a winner is archived,
  everyone's votes/comments stay visible forever. People say things
  in vote comments they wouldn't want preserved (jokes,
  judgments). Mitigation: auto-redact comments older than N days
  on archived battles; let the organizer scrub specific entries.
- **Server logs** — Next.js + cloudflared both log full request
  paths by default. If the tunnel URL contains the invite code as
  a query param, it lands in logs. Make sure invite codes are NEVER
  in the URL (currently they're a separate form submission, but
  audit).

### Next concrete actions (for the discussion)

1. Add a `PRIVACY.md` documenting all of the above so self-hosters
   know what they're shipping.
2. Add a "share preview" UI that previews exactly what a voter will
   see when they hit the link, before the organizer copies the URL.
3. Add the "obscure my name" voter setting.
4. Build a "scrub before archive" flow that nukes addresses + lat/lng
   from the trophy case on close.
5. Audit the cloudflared logging integration to make sure invite
   codes / PINs never end up in access logs.

## Availability detection improvements

(Tracked separately as the work goes — see `src/lib/availability.ts`.)
The static-HTML check is ~80–85% accurate. Real eligibility happens
client-side via GraphQL. Footer + badge already disclaim this. A
deeper fix would be hitting Airbnb's GraphQL endpoint directly with
the trip dates + guest count, but that's a brittle path Airbnb actively
churns. The override system + "Verify on Airbnb" call-to-action are the
practical workaround.
