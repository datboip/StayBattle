"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshAvailability } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { confirmDialog } from "./Modal";
import { isDisqualified } from "@/lib/rank";
import type { ListingWithStats } from "@/lib/types";
import type { Battle } from "@/lib/battle";

/**
 * Organizer-only top-of-page panel for availability monitoring. Surfaces:
 *   - When the roster's data was last re-checked against Airbnb
 *   - "+N newly booked" since the previous recheck
 *   - At-a-glance counts (available / unknown / booked)
 *   - Buttons: cached recheck (safe, 30-min throttled) + force recheck
 *     (bypasses cache, gated behind confirm dialog)
 *
 * Rendering nothing for non-organizers is intentional: regular voters
 * shouldn't see recheck controls.
 */
export function AvailabilityPanel({
  listings,
  battle,
}: {
  listings: ListingWithStats[];
  battle: Battle;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isRechecking, startRecheck] = useTransition();
  const [recheckStartedAt, setRecheckStartedAt] = useState<number | null>(null);
  const [preCheckStatuses, setPreCheckStatuses] = useState<Map<string, string | null> | null>(null);
  const [newlyBookedCount, setNewlyBookedCount] = useState<number>(0);
  // Sticky one-line status message that explains what just happened after a
  // recheck completes. Examples: "no changes", "1 changed", "2 changed —
  // 1 newly booked, 1 newly available". Auto-clears after 30s.
  const [lastResult, setLastResult] = useState<string | null>(null);

  const isOrganizer = !!(voter && voter.id === battle.organizer_id);

  // Most-recent availability check across the roster.
  const checkedTimestamps = listings
    .map((l) => l.availability_checked_at)
    .filter((t): t is string => t !== null)
    .map((t) => new Date(t).getTime());
  const latestCheck =
    checkedTimestamps.length > 0 ? Math.max(...checkedTimestamps) : null;

  // True while the queue is still draining for THIS recheck (any listing
  // hasn't had its availability_checked_at updated since we clicked).
  const recheckInFlight =
    recheckStartedAt !== null &&
    listings.some(
      (l) =>
        !l.availability_checked_at ||
        new Date(l.availability_checked_at).getTime() < recheckStartedAt - 30 * 60_000,
    );

  // At-a-glance availability counts (after rank disqualification logic).
  const counts = listings.reduce(
    (acc, l) => {
      if (isDisqualified(l)) acc.booked += 1;
      else if (l.availability_status === "available") acc.available += 1;
      else acc.unknown += 1;
      return acc;
    },
    { available: 0, unknown: 0, booked: 0 },
  );

  // Compute change summary when results land after a recheck completes:
  // total changes, plus a breakdown of available↔booked transitions to
  // populate the inline status message and the "+N newly booked" chip.
  useEffect(() => {
    if (!preCheckStatuses || recheckInFlight) return;
    let newlyBooked = 0;
    let newlyAvailable = 0;
    let otherChanges = 0;
    for (const l of listings) {
      const before = preCheckStatuses.get(l.id) ?? null;
      const after = l.availability_status;
      if (before === after) continue;
      if (before !== "unavailable" && after === "unavailable") newlyBooked += 1;
      else if (before === "unavailable" && after !== "unavailable") newlyAvailable += 1;
      else otherChanges += 1;
    }
    const total = newlyBooked + newlyAvailable + otherChanges;
    setNewlyBookedCount(newlyBooked);

    // Compose the sticky status line.
    let msg: string;
    if (total === 0) {
      msg = "checked · no changes";
    } else {
      const parts: string[] = [];
      if (newlyBooked > 0) parts.push(`${newlyBooked} newly booked`);
      if (newlyAvailable > 0) parts.push(`${newlyAvailable} newly available`);
      if (otherChanges > 0) parts.push(`${otherChanges} other`);
      msg = `checked · ${total} changed — ${parts.join(", ")}`;
    }
    setLastResult(msg);
    setPreCheckStatuses(null);

    const t1 = setTimeout(() => setNewlyBookedCount(0), 60_000);
    const t2 = setTimeout(() => setLastResult(null), 30_000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [listings, preCheckStatuses, recheckInFlight]);

  // Progress counter during a recheck: how many listings have been re-checked
  // (their availability_checked_at moved past recheckStartedAt). Used to
  // show "checking 5 of 24…" in the live status line.
  const progressedCount =
    recheckStartedAt !== null
      ? listings.filter(
          (l) =>
            l.availability_checked_at &&
            new Date(l.availability_checked_at).getTime() >= recheckStartedAt,
        ).length
      : 0;

  const runRecheck = (force: boolean) => {
    const now = Date.now();
    setRecheckStartedAt(now);
    setPreCheckStatuses(
      new Map(listings.map((l) => [l.id, l.availability_status])),
    );
    setNewlyBookedCount(0);
    startRecheck(async () => {
      await refreshAvailability(undefined, force);
      router.refresh();
    });
    // Hard upper-bound: never stay locked longer than (listings * 2s + 5s).
    const maxMs = listings.length * 2000 + 5000;
    setTimeout(
      () => setRecheckStartedAt((prev) => (prev === now ? null : prev)),
      maxMs,
    );
  };

  const forceRecheck = async () => {
    const ok = await confirmDialog({
      title: "Force-recheck all listings?",
      body: `Normal recheck skips listings checked in the last 30 minutes — that protects us from Airbnb's rate limiter. Force will re-check ALL ${listings.length} listings regardless. Useful right before locking in a winner, but spam-clicking force will get you flagged and rechecks will start failing. Use sparingly.`,
      confirm: "Force recheck",
      cancel: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    runRecheck(true);
  };

  if (!isOrganizer) return null;
  if (listings.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="sb-fight-label text-zinc-200">Availability</span>
          <span className="rounded-sm border border-amber-500/40 bg-amber-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
            organizer only
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => runRecheck(false)}
            disabled={isRechecking || recheckInFlight}
            aria-busy={recheckInFlight}
            className="inline-flex items-center gap-1.5 rounded-sm border border-zinc-700 bg-zinc-950/60 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            title="Re-check availability (skips listings checked in the last 30 min). Queue paces requests at ~1.2s each. Spam-click safe."
          >
            {(isRechecking || recheckInFlight) && <Spinner />}
            {recheckInFlight
              ? `checking ${listings.length}…`
              : isRechecking
                ? "queueing…"
                : "↻ recheck"}
          </button>
          <button
            type="button"
            onClick={forceRecheck}
            disabled={isRechecking || recheckInFlight}
            aria-busy={recheckInFlight}
            className="inline-flex items-center gap-1.5 rounded-sm border border-amber-500/40 bg-amber-500/5 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-300 hover:border-amber-500/80 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            title="Bypass the 30-min cache and recheck EVERY listing. Asks for confirmation first. Use right before locking in a winner — overuse risks Airbnb rate-limiting."
          >
            ⚡ force
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        <span>
          <span className="text-[#10C8D2]">{counts.available}</span> available
        </span>
        <span>
          <span className="text-zinc-300">{counts.unknown}</span> unknown
        </span>
        <span>
          <span className="text-[#FF6C51]">{counts.booked}</span> booked
        </span>
        {latestCheck !== null && (
          <span
            className="text-zinc-500"
            title={`Most recent availability check: ${new Date(latestCheck).toLocaleString()}.`}
          >
            checked <TimeAgo timestamp={latestCheck} />
          </span>
        )}
        {newlyBookedCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-sm border border-[#FF6C51]/40 bg-[#FF6C51]/10 px-1.5 py-0.5 text-[#FF6C51]"
            title="Listings that went from available → booked since the last recheck."
          >
            +{newlyBookedCount} newly booked
          </span>
        )}
      </div>

      {/* Live status line. During a recheck shows progress; after, shows the
          one-line result. Stays empty when idle so it doesn't take space. */}
      {(recheckInFlight || lastResult) && (
        <div
          className="font-mono text-[10px] uppercase tracking-wider"
          role="status"
          aria-live="polite"
        >
          {recheckInFlight ? (
            <span className="inline-flex items-center gap-1.5 text-cyan-300">
              <Spinner />
              checking {progressedCount} of {listings.length}…
            </span>
          ) : (
            <span className="text-zinc-400">{lastResult}</span>
          )}
        </div>
      )}
    </section>
  );
}

/** Tiny spinning circle for "this is working, don't touch" feedback. */
function Spinner() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TimeAgo({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, now - timestamp);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  let label: string;
  if (sec < 30) label = "just now";
  else if (min < 1) label = `${sec}s ago`;
  else if (hr < 1) label = `${min}m ago`;
  else if (day < 1) label = `${hr}h ago`;
  else if (day < 7) label = `${day}d ago`;
  else label = new Date(timestamp).toLocaleDateString();
  const stale = hr >= 1;
  return (
    <span className={stale ? "text-amber-400" : ""}>
      {label}
      {stale && " · may be stale"}
    </span>
  );
}
