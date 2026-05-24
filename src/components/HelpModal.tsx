"use client";

import { useEffect, useState } from "react";
import { useVoter } from "@/lib/voter";
import type { Battle } from "@/lib/battle";

function QuestionIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

type SectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function YouCanDo({
  hasBattle,
  isOrganizer,
  phase,
}: {
  hasBattle: boolean;
  isOrganizer: boolean;
  phase: "submission" | "voting" | "closed" | null;
}) {
  if (!hasBattle) {
    return (
      <>
        <p>
          There&apos;s no active battle right now. Anyone signed in can{" "}
          <strong className="text-zinc-100">create one</strong> — fill in
          the trip name, dates, and submission deadline. Whoever creates
          it becomes the <strong className="text-amber-300">organizer</strong>{" "}
          of that battle. So if you&apos;re hosting your crew&apos;s trip,
          create the battle first before sharing the URL so you keep the
          organizer role.
        </p>
        <p>
          Past battles (if any) live in the trophy case below.
        </p>
      </>
    );
  }

  if (phase === "submission") {
    return (
      <>
        <p>
          The battle is in <strong className="text-cyan-300">submission
          phase</strong> — everyone&apos;s dropping listings in. Voting
          opens when the deadline hits or the organizer starts it early.
        </p>
        <p className="font-semibold text-zinc-100">As a crew member:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong className="text-zinc-100">Paste Airbnb URLs</strong>{" "}
            in the box at the top. Paste multiple at once with the
            &ldquo;Paste multiple&rdquo; toggle.
          </li>
          <li>
            <strong className="text-zinc-100">See your submissions</strong>{" "}
            below. Nobody else sees them yet — they see only anonymized
            photo teasers from the whole pool.
          </li>
          <li>
            <strong className="text-zinc-100">Add hype</strong> to your
            listings — a one-liner pinned at the top of the comments
            when voting opens. Your &ldquo;opening argument.&rdquo;
          </li>
          <li>
            <strong className="text-zinc-100">Remove your own
            submissions</strong> any time before the battle starts. You
            can&apos;t touch other people&apos;s submissions during this
            phase.
          </li>
        </ul>
        {isOrganizer && (
          <>
            <p className="mt-2 font-semibold text-amber-300">
              Bonus, as organizer:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong className="text-zinc-100">Start battle now</strong>{" "}
                — skip the deadline and open voting immediately.
              </li>
              <li>
                <strong className="text-zinc-100">Generate a new
                code</strong> if the current one leaks. Already-joined
                people stay in.
              </li>
              <li>
                <strong className="text-zinc-100">Kick anyone</strong>{" "}
                from the participant list.
              </li>
              <li>
                <strong className="text-zinc-100">Reset</strong> the
                whole battle (deletes everything, can&apos;t be undone).
              </li>
            </ul>
          </>
        )}
      </>
    );
  }

  if (phase === "voting") {
    return (
      <>
        <p>
          The battle is{" "}
          <strong className="text-rose-300">live for voting</strong> —
          all listings are visible, weigh in on whichever ones you have
          opinions on.
        </p>
        <p className="font-semibold text-zinc-100">As a crew member:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong className="text-emerald-300">Upvote</strong> (▲) or{" "}
            <strong className="text-rose-300">downvote</strong> (▼) any
            listing. Click again to clear your vote.
          </li>
          <li>
            <strong className="text-zinc-100">Trash talk</strong> — open
            comments on any card, leave a take, reply to others.
          </li>
          <li>
            <strong className="text-zinc-100">Review one-by-one</strong>{" "}
            (button next to the sort) — swipe-through focused review,
            shows you what you haven&apos;t voted on first. Keyboard
            shortcuts inside.
          </li>
          <li>
            <strong className="text-zinc-100">Sort the roster</strong> by
            score, total votes, or newest. Hide booked listings
            entirely with the toggle.
          </li>
          <li>
            <strong className="text-zinc-100">Add map pins</strong> —
            anything you want shown on the battle map (theme parks,
            specific restaurants, the airport). Type a name, address,
            or paste a maps link.
          </li>
          <li>
            <strong className="text-zinc-100">Click any photo</strong>{" "}
            for a full-screen lightbox (arrow keys to flip).
          </li>
          <li>
            <strong className="text-zinc-100">Click any availability
            badge</strong> for the full story on whether dates work,
            plus a recheck button.
          </li>
        </ul>
        {isOrganizer && (
          <>
            <p className="mt-2 font-semibold text-amber-300">
              Bonus, as organizer:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong className="text-zinc-100">Override availability</strong>{" "}
                on any &ldquo;booked&rdquo; listing if you know it&apos;s
                actually free (you have to give a reason).
              </li>
              <li>
                <strong className="text-zinc-100">Close the battle</strong>{" "}
                — archives the top 3 to the trophy case and wipes the
                active battle so a new trip can start.
              </li>
              <li>
                <strong className="text-zinc-100">Regen invite code</strong>
                , <strong className="text-zinc-100">kick</strong>{" "}
                participants, or{" "}
                <strong className="text-zinc-100">Reset</strong>{" "}
                everything (no archive).
              </li>
              <li>
                <strong className="text-zinc-100">Delete any
                comment</strong> if it needs to come off.
              </li>
            </ul>
          </>
        )}
      </>
    );
  }

  // closed / unknown phase
  return (
    <p>
      This battle is closed. Check the trophy case below for the result.
    </p>
  );
}

function Section({ title, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-100 hover:text-rose-200"
      >
        <span>{title}</span>
        <span
          aria-hidden="true"
          className={`font-mono text-[10px] uppercase tracking-wider text-zinc-500 transition-transform duration-300 ${
            open ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 px-4 pb-4 text-[13px] leading-relaxed text-zinc-300">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HelpButton({ battle }: { battle?: Battle | null }) {
  const [open, setOpen] = useState(false);
  const { voter } = useVoter();
  const isOrganizer = !!(voter && battle && voter.id === battle.organizer_id);
  const phase = battle?.phase ?? null;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help and information"
        title="Help / how it works"
        className="flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-950/60 text-zinc-300 transition hover:border-rose-500/60 hover:text-rose-300"
      >
        <QuestionIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="How StayBattle works"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full flex-col rounded-none border-zinc-800 bg-zinc-950 shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:border"
            style={{ maxHeight: "100dvh" }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  <span className="sb-gradient-text">Stay</span>
                  <span className="text-zinc-50">Battle</span>{" "}
                  <span className="text-zinc-400">· How it works</span>
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  Tap a section to expand
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-zinc-700 text-zinc-300 hover:border-rose-500/60 hover:text-rose-300"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-5">
              <Section
                title={`What can I do${
                  isOrganizer
                    ? " (as the organizer)"
                    : voter
                      ? ""
                      : ""
                }?`}
                defaultOpen
              >
                <YouCanDo
                  hasBattle={!!battle}
                  isOrganizer={isOrganizer}
                  phase={phase}
                />
              </Section>

              <Section title="What is this?">
                <p>
                  StayBattle is a tool to help your group decide where to
                  stay on a vacation. Someone is planning a trip; everyone
                  drops their favorite Airbnb candidates in; everyone votes;
                  the most-loved listing wins.
                </p>
                <p>
                  You still book on Airbnb yourself — StayBattle just
                  organizes the decision. No payments, no bookings, no
                  middleman. Think of it as a group chat with structure.
                </p>
              </Section>

              <Section title="Roles">
                <p>
                  <strong className="text-zinc-100">Organizer</strong> —
                  whoever created the battle. They set the trip name,
                  dates, and submission deadline; they hand out the invite
                  code; they can start the battle early, reset everything,
                  close the battle, or kick someone.
                </p>
                <p>
                  <strong className="text-zinc-100">Crew</strong> —
                  everyone who joined with the invite code. Full vote and
                  comment rights, can submit listings, can remove their own
                  submissions during the submission phase.
                </p>
                <p>
                  <strong className="text-zinc-100">Server admin</strong>{" "}
                  — the person whose computer this app runs on. They own
                  the data file. Outside the app entirely.
                </p>
              </Section>

              <Section title="The phases">
                <p>
                  <strong className="text-zinc-100">1. Submission</strong>{" "}
                  — Open until the deadline (or until the organizer hits
                  &ldquo;Start battle now&rdquo;). Everyone drops Airbnb
                  URLs in. Other people see only a teaser of anonymized
                  photos — no titles, no votes, no name attribution. You
                  see only your own submissions in full, and can edit /
                  remove them or attach your &ldquo;hype&rdquo; (your
                  pinned argument for why your pick should win).
                </p>
                <p>
                  <strong className="text-zinc-100">2. Battle</strong> —
                  All listings reveal at once. Vote up or down. Leave
                  comments. Use the one-at-a-time review mode if you want
                  a focused walk-through. Each submitter&apos;s hype shows
                  up pinned at the top of their listing&apos;s comments.
                </p>
                <p>
                  <strong className="text-zinc-100">3. Close</strong> —
                  Organizer archives the top 3 (with ties grouped as
                  co-medalists) to the trophy case, then wipes the active
                  battle so the next trip can start. Past battles keep
                  just the season (month/year), the podium, and summary
                  counts. No comments preserved.
                </p>
              </Section>

              <Section title="Voting & review mode">
                <p>
                  Each card has an{" "}
                  <strong className="text-emerald-300">upvote</strong>{" "}
                  (▲) and a{" "}
                  <strong className="text-rose-300">downvote</strong> (▼).
                  Click again to clear your vote. Your votes show under
                  the card so the crew can see who&apos;s on what side.
                </p>
                <p>
                  <strong className="text-zinc-100">Review mode</strong>{" "}
                  is a swipe-through one-card-at-a-time view, ordered to
                  show you cards you haven&apos;t weighed in on first.
                  Keyboard shortcuts: ↑/U upvote, ↓/D downvote, →/space
                  next, ← previous, Esc exit.
                </p>
                <p>
                  Sort the grid by{" "}
                  <em className="text-zinc-200">Score</em> (with a
                  fresh-listing boost),{" "}
                  <em className="text-zinc-200">Most votes</em> (most
                  engagement first), or{" "}
                  <em className="text-zinc-200">Newest</em>. Hide
                  &ldquo;booked&rdquo; listings entirely with the toggle
                  next to the sort.
                </p>
              </Section>

              <Section title="Availability badges">
                <p>
                  When trip dates are set, the server checks each Airbnb
                  page to see if those dates are bookable. Each card gets
                  a small badge:
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    <strong className="text-emerald-300">available</strong>{" "}
                    — Airbnb&apos;s booking widget loaded
                  </li>
                  <li>
                    <strong className="text-rose-300">booked</strong> —
                    the dates show as unavailable
                  </li>
                  <li>
                    <strong className="text-zinc-300">checking…</strong>{" "}
                    — the check hasn&apos;t run yet or the dates changed
                  </li>
                </ul>
                <p>
                  Click the badge for the full story — common reasons it
                  might be wrong (min-stay requirements, request-to-book,
                  stale calendar) and a button to recheck or, for the
                  organizer, to override with a note explaining why
                  it&apos;s actually available.
                </p>
                <p>
                  The check is{" "}
                  <strong className="text-zinc-100">~95% accurate</strong>{" "}
                  — always click through to Airbnb before booking.
                </p>
              </Section>

              <Section title="The map">
                <p>
                  Every listing pins to the map by its lat/lng. Blue pins
                  are listings, amber dots are{" "}
                  <strong className="text-amber-300">reference places</strong>{" "}
                  — landmarks anyone in the crew can add (resorts, theme
                  parks, dinner spots) to give context. Pin a place by
                  typing a name (e.g.{" "}
                  <em className="text-zinc-200">&ldquo;SeaWorld
                  San Diego&rdquo;</em>), an address, or pasting an
                  Apple/Google Maps share link.
                </p>
                <p>
                  Tiles come from{" "}
                  <strong className="text-zinc-100">OpenStreetMap</strong>{" "}
                  (no Google or Mapbox account needed). Geocoding uses
                  Nominatim with a viewbox bias toward your existing
                  listings so generic names land in the right region.
                </p>
              </Section>

              <Section title="The trophy case">
                <p>
                  Past battles archive into a read-only trophy case at the
                  bottom of the page. For each, you see:
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>The trip name + season (month/year only)</li>
                  <li>
                    Podium top 3 by score, with ties grouped as
                    co-medalists
                  </li>
                  <li>Total people, listings, and votes</li>
                  <li>Who organized it</li>
                </ul>
                <p>
                  Exact dates, comments, and individual vote attributions
                  are not stored — just summary numbers. The organizer
                  can prune any past battle with the × button.
                </p>
              </Section>

              <Section title="Privacy & data">
                <p>
                  Your name, PIN (hashed with scrypt), votes, and comments
                  all live in a single SQLite file on whatever computer
                  the organizer set this up on. They never leave that
                  computer.
                </p>
                <p>
                  <strong className="text-zinc-100">No analytics.</strong>{" "}
                  No tracking pixels. No third-party JavaScript. No email
                  collection — there&apos;s no way to even put one in.
                </p>
                <p>
                  Outbound traffic, in full: one fetch to{" "}
                  <em className="text-zinc-200">airbnb.com</em> when a
                  listing URL is added (to grab the title, photos,
                  rating). One fetch to{" "}
                  <em className="text-zinc-200">
                    nominatim.openstreetmap.org
                  </em>{" "}
                  when a place is pinned. Tile images from{" "}
                  <em className="text-zinc-200">
                    *.tile.openstreetmap.org
                  </em>{" "}
                  while the map is on screen. That&apos;s it.
                </p>
                <p>
                  Sign out from the menu next to your name to clear your
                  session on this device. The organizer can{" "}
                  <em className="text-zinc-200">Reset</em> to wipe
                  everything server-side.
                </p>
              </Section>

              <Section title="How the tech works">
                <p>
                  <strong className="text-zinc-100">Stack</strong> —
                  Next.js 16 (App Router) + React 19 + SQLite (better-sqlite3) +
                  Tailwind 4 + Leaflet for the map. Self-hostable
                  anywhere that runs Node or Docker.
                </p>
                <p>
                  <strong className="text-zinc-100">Listing scrape</strong>{" "}
                  — When someone pastes a URL, the server does one HTTP
                  GET to that page with a real-browser User-Agent.
                  Cheerio parses the JSON-LD <code>VacationRental</code>{" "}
                  block, which Airbnb publishes for SEO and contains the
                  title, photos, location, lat/lng, and rating. Bedrooms /
                  baths / beds come from regex on the OG title. Price is
                  deliberately skipped — Airbnb only computes price for
                  specific dates.
                </p>
                <p>
                  <strong className="text-zinc-100">Identity</strong> —
                  Your name + 4–6 digit PIN. The PIN is hashed with{" "}
                  <em className="text-zinc-200">scrypt</em> (N=16384,
                  random per-voter salt) and stored server-side. Sign-in
                  is rate-limited to 5 attempts/min/name to make
                  brute-forcing impractical.
                </p>
                <p>
                  <strong className="text-zinc-100">
                    &ldquo;Live&rdquo; updates
                  </strong>{" "}
                  — Every page polls the server every 6 seconds and
                  re-renders if anything changed. Cheap; no WebSockets or
                  pub-sub infrastructure needed.
                </p>
                <p>
                  <strong className="text-zinc-100">License</strong> —
                  AGPL v3. Use it, fork it, improve it, share back. Source
                  at{" "}
                  <a
                    href="https://github.com/datboip/StayBattle"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 underline decoration-cyan-800 hover:decoration-cyan-300"
                  >
                    github.com/datboip/StayBattle
                  </a>
                  .
                </p>
              </Section>

              <Section title="Troubleshooting">
                <p>
                  <strong className="text-zinc-100">
                    Stuck on &ldquo;Loading…&rdquo;
                  </strong>{" "}
                  — The dev server is blocking your host. Tell the server
                  admin to add your domain to <code>allowedDevOrigins</code>{" "}
                  in <code>next.config.ts</code>. Most tunnel domains are
                  already covered.
                </p>
                <p>
                  <strong className="text-zinc-100">
                    Wrong PIN for my name
                  </strong>{" "}
                  — There&apos;s no email reset. Easiest fix: pick a
                  slightly different name and start fresh.
                </p>
                <p>
                  <strong className="text-zinc-100">
                    Invite code not working
                  </strong>{" "}
                  — Codes are 6 letters/numbers, case-insensitive, no
                  ambiguous chars (no 0/O or 1/I). If the organizer hit
                  &ldquo;New code&rdquo; recently, you need the new one.
                </p>
                <p>
                  <strong className="text-zinc-100">
                    My listing shows as &ldquo;booked&rdquo; but it
                    isn&apos;t
                  </strong>{" "}
                  — Click the badge. The organizer can override with a
                  reason. Common causes: min-stay requirements, host
                  using request-to-book, or stale calendar.
                </p>
                <p>
                  <strong className="text-zinc-100">
                    I want to leave the battle
                  </strong>{" "}
                  — There&apos;s no &ldquo;leave&rdquo; button currently.
                  Sign out from your name menu, or ask the organizer to
                  kick you.
                </p>
              </Section>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-zinc-800 px-5 py-3 text-center text-[10px] uppercase tracking-wider text-zinc-500">
              Unaffiliated with Airbnb, Inc. · AS IS, no warranty · AGPL v3
            </div>
          </div>
        </div>
      )}
    </>
  );
}
