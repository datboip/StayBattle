# Privacy & threat model

This document is for **self-hosters** so they know what StayBattle does
and doesn't do with the data the crew puts into it. It is also for the
**crew**: when you click an invite link, what does the host learn about
you, and who else could see it?

If you're casually picking an Airbnb with five close friends, most of
what follows won't matter. It matters more if the link gets forwarded,
the tunnel URL leaks, or someone in the crew is in an adversarial
situation with someone outside it (estranged partner, harassment, etc).

---

## What StayBattle stores

A single SQLite file at `$STAYBATTLE_DB_DIR/quickie.db` (default
`~/staybattle/data/`). The schema is in
[`src/lib/db.ts`](src/lib/db.ts). The rows are:

| Table | Holds | Sensitivity |
|---|---|---|
| `voters` | display name + `name_key` (lowercased) + scrypt-hashed PIN | Names are pseudonyms by intent; PINs are scrypt N=16384 with per-row salt. |
| `participants` | which voters are in which battles | Reveals "X is in this trip's crew." |
| `settings` | battle name, organizer, invite code, trip dates, deadline | Invite code is a shared secret. |
| `listings` | URL, title, photos (hot-linked), bedrooms/etc, lat/lng | Reveals candidate rentals + their locations. |
| `votes` | (voter_id, listing_id, 1-5 rating) | Reveals individual preferences. |
| `comments` | (voter_id, listing_id, free text) | The "trash talk." Free text is the wildcard. |
| `places` | dropped reference pins (name, lat/lng, optional URL, category) | Reveals places the crew cares about. |
| `past_battles` | name, **month-only check_in/out**, organizer, podium (title/photo/city — *no URL, no exact lat/lng*) | Trophy case. Date-scrubbed. |

**Nothing leaves the box** except outbound fetches you can list on one
hand:

- One HTTPS request to `airbnb.com` per pasted URL (scrape the listing).
- One HTTPS request to `nominatim.openstreetmap.org` per geocode.
- Tile images from `*.tile.openstreetmap.org` when the map is open.
- Listing photos hot-linked from `*.muscache.com` (Airbnb's CDN) — we
  don't proxy or re-host them.

No analytics, no telemetry, no third-party JavaScript, no cookies for
anything except your own server-side auth (see below).

---

## What the server knows about visitors

- **An auth cookie**: set on sign-in, holds `{id, name}` of the
  signed-in voter. Used by the server-side gate (see below) so SSR
  can tell whether to render battle data or not. Not httpOnly because
  the same identity also drives the client UI — that means
  `document.cookie` exposes it to your own client-side JS, same trust
  surface as the existing localStorage flow.
- **What's in your nginx access log**: the request line, but using a
  scrubbed `log_format` that writes `$uri` instead of `$request` — the
  query string is dropped before the log entry hits disk. Invite codes
  ride in the URL FRAGMENT (`#invite=…`), which the browser never
  sends to the server in the first place.
- **What's in journalctl**: whatever the Next.js process writes to
  stdout/stderr. The app codebase has zero `console.log` /
  `console.error` calls in `src/`, so the only noise is Next's own
  request log line.

---

## Who can see the battle?

The full battle (listings, lat/lng, votes, comments, participants) is
rendered **server-side only** when the request carries a voter cookie
for a voter who is a participant of that battle. Anonymous visitors
and non-participant visitors get a stripped page: the battle name and
organizer's display name (needed for the join prompt), the trophy case
of past battles (social proof, already scrubbed), and that's it.

This is enforced in [`src/app/page.tsx`](src/app/page.tsx) — see the
`isMember` branch. The fix landed 2026-05-27 after an audit caught a
big leak where the gate had been client-side only.

The pre-gate render strips `invite_code` and `organizer_id` from the
`battle` object too (see [`src/lib/battle.ts`](src/lib/battle.ts)
`PublicBattle`).

---

## Threats StayBattle addresses

### Invite-link recipient is an attacker
The link contains an invite code in the URL fragment (`#invite=…`).
Fragments are never sent to servers, so even if the recipient is
hostile or the link is captured in a network log, the invite code
itself stays client-side. They still have to sign in with a name+PIN
and join the battle before they see any data.

### The shared infrastructure (nginx, cloudflared, log shippers) is breached
Logs use a scrubbed format that drops query strings. There's no
sensitive data in headers, cookies are `SameSite=Lax` and only valid
for the app domain. PINs are scrypt-hashed before persistence.

### A voter gets their localStorage stolen
The voter id alone gates UI access but the **server** trusts only the
cookie value, which is independent of localStorage. Stealing
localStorage doesn't let you impersonate over a server boundary unless
you also have the cookie. Steal both → you're that voter (same risk as
any cookie-auth app — pair with full-disk encryption if you care).

### The trophy case becomes a permanent record of where you've been
Archived battles store **month-only** check-in/out dates and **no
clickable Airbnb URL**. The "house was empty in summer 2026" trace is
month-grained; the "which exact rental" trace via image URL is still
visible (we keep the listing photo, and Airbnb image URLs embed the
listing id). The latter is a deliberate trade-off: photos make the
trophy case worth having; if you want full scrub, delete the past
battle from the organizer panel.

---

## Threats StayBattle does NOT (yet) address

### Tunnel URLs are publicly enumerable
If you expose StayBattle over a Cloudflare quick tunnel
(`https://random.trycloudflare.com`), the subdomain is in Cloudflare's
shared CT log and scrapers find them. The **content** is still gated
behind the invite code, but the existence of a StayBattle instance at
that URL is discoverable.

**Mitigation:** use a named tunnel with your own domain
(`battles.yourdomain.com`) instead of a quick tunnel, or run on a LAN
IP that's only reachable from your crew's network.

### Voter display names default to real names
The NameGate doesn't enforce pseudonyms — many users put their real
name. Combined with any other field (a comment quoting their day, a
listing they submitted in their neighborhood), the data could be tied
back to them.

**Mitigation (current):** tell your crew to use first-name-only or a
nickname. **Mitigation (future):** a "obscure my name" voter setting
that swaps the display for `voter-#7` — tracked in
[TODO.md](TODO.md), not yet shipped.

### The image URL in past battles encodes the listing id
Airbnb's CDN URLs look like
`a0.muscache.com/.../Hosting-{listingId}/...`. The trophy case keeps
the photo for visual interest, and you can recover the listing id
from the image path. If the threat is "someone shouldn't know we
stayed at this exact rental", delete the past battle row from the
organizer panel after the trip.

### The pin a voter sets is checked once per browser
After sign-in we don't re-prompt for the PIN per action. Browser-share
on a public terminal will leak the session until the user signs out.
This is intentional UX — the threat is bounded by physical access.

### Server logs (journalctl, nginx) still rotate to disk
Even with the scrubbed log_format, journalctl retains the last weeks
of request paths on the VPS. If you're audit-paranoid, set
`StandardOutput=null` in [`staybattle.service`](staybattle-site/infra/staybattle.service)
to silence the Next.js stdout, or run with `Storage=volatile` for the
journal so it doesn't persist.

---

## What an organizer can do for their crew

- **Rotate the invite code** any time from the organizer panel. The
  old code stops working immediately.
- **Kick a participant** — removes them from the battle. Their votes
  optionally come with them; their comments stay (the threat-model
  trade-off is "preserve what they said, remove their ongoing access").
- **Close the battle** — archives to trophy case (month-scrubbed,
  no clickable URLs).
- **Delete the battle** — wipes listings, votes, comments. Voter
  identities persist across battles, so they can still join a future
  one with the same name+PIN.

---

## What a self-hoster can do for everyone

- **Run behind your own named tunnel or domain**, not a Cloudflare
  quick tunnel — see "Tunnel URLs are publicly enumerable" above.
- **Set a strong invite code** (organizer rotates it on each
  battle close).
- **Don't expose the box's filesystem to other users.** The DB is
  unencrypted; full-disk encryption on the host is the right defense.
- **Daily backups** if you're past demo mode. Recommended pattern:
  a `systemd` oneshot that runs `sqlite3 .backup` (consistent against
  in-flight writes) into a backups dir, fired by a daily timer with
  `Persistent=true` so a stretch of downtime catches up on next boot.
  Same-box backups don't survive disk failure — wire an off-box
  destination (S3, rclone to R2, scp to a separate host) before you
  flip out of demo mode.

---

## Reporting an issue

If you've found a privacy leak that isn't documented here, please
file it via the [security policy](SECURITY.md) before posting
publicly — same channel as any other vulnerability.
