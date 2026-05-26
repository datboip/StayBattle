"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rankListings, isDisqualified, type SortMode } from "@/lib/rank";
import type { ListingWithStats } from "@/lib/types";
import type { TripDates } from "@/lib/trip";
import type { Battle } from "@/lib/battle";
import { ListingCard } from "./ListingCard";
import { ReviewMode } from "./ReviewMode";
import { useVoter } from "@/lib/voter";

const MODES: { value: SortMode; label: string }[] = [
  { value: "score", label: "Score" },
  { value: "votes", label: "Most votes" },
  { value: "recent", label: "Newest" },
];

type ColumnMode = "auto" | "1" | "2" | "3";
const COLUMN_STORAGE_KEY = "sb-roster-cols";

// Each column option's icon is a tiny grid layout: one big rect, two
// side-by-side rects, three side-by-side rects. The icon IS the meaning —
// no translation from a number to a layout in the user's head.
// "Auto" stays as text since "fit to viewport" doesn't have an obvious icon.
function ColumnIcon({ count }: { count: 1 | 2 | 3 }) {
  if (count === 1) {
    return (
      <svg viewBox="0 0 16 12" width="14" height="10" aria-hidden="true">
        <rect x="2" y="2" width="12" height="8" rx="1" fill="currentColor" />
      </svg>
    );
  }
  if (count === 2) {
    return (
      <svg viewBox="0 0 16 12" width="14" height="10" aria-hidden="true">
        <rect x="2" y="2" width="5.5" height="8" rx="1" fill="currentColor" />
        <rect x="8.5" y="2" width="5.5" height="8" rx="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 12" width="14" height="10" aria-hidden="true">
      <rect x="2" y="2" width="3.3" height="8" rx="0.5" fill="currentColor" />
      <rect x="6.35" y="2" width="3.3" height="8" rx="0.5" fill="currentColor" />
      <rect x="10.7" y="2" width="3.3" height="8" rx="0.5" fill="currentColor" />
    </svg>
  );
}

const COLUMNS: Array<
  | { value: "auto"; label: "Auto"; aria: string }
  | { value: "1" | "2" | "3"; label: 1 | 2 | 3; aria: string }
> = [
  { value: "auto", label: "Auto", aria: "Auto-fit columns to viewport" },
  { value: "1", label: 1, aria: "One column per row" },
  { value: "2", label: 2, aria: "Two columns per row" },
  { value: "3", label: 3, aria: "Three columns per row" },
];

export function ListingGrid({
  listings,
  tripDates,
  battle,
}: {
  listings: ListingWithStats[];
  tripDates: TripDates;
  battle?: Battle | null;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [mode, setMode] = useState<SortMode>("score");
  const [reviewing, setReviewing] = useState(false);
  const [hideBooked, setHideBooked] = useState(false);
  // Column count: persisted to localStorage so a user's preferred density
  // sticks across reloads. SSR-safe: starts "auto" then upgrades from
  // storage in effect.
  const [columns, setColumns] = useState<ColumnMode>("auto");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (stored === "auto" || stored === "1" || stored === "2" || stored === "3") {
        setColumns(stored);
      }
    } catch {
      // localStorage blocked in private mode etc — fine, stay on "auto"
    }
  }, []);
  const pickColumns = (next: ColumnMode) => {
    setColumns(next);
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, next);
    } catch {}
  };

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 6000);
    const onVis = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  const allRanked = rankListings(listings, mode);
  const bookedCount = allRanked.filter(isDisqualified).length;
  const ranked = hideBooked
    ? allRanked.filter((l) => !isDisqualified(l))
    : allRanked;

  if (reviewing && voter) {
    return (
      <ReviewMode
        listings={ranked}
        tripDates={tripDates}
        battle={battle}
        onClose={() => setReviewing(false)}
      />
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-zinc-800 py-20 text-center">
        <p className="sb-fight-label text-zinc-300">no contenders</p>
        <p className="text-sm text-zinc-400">
          Drop an Airbnb URL above to start the fight.{" "}
          <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 font-mono text-[10px] text-zinc-300">
            /
          </kbd>{" "}
          focuses it.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="sb-fight-label text-zinc-200">
          The roster · {ranked.length} contender{ranked.length === 1 ? "" : "s"}
          {bookedCount > 0 && (
            <span className="ml-2 font-mono text-[10px] normal-case tracking-normal text-rose-300">
              ({bookedCount} booked
              {hideBooked ? "" : `, ranked last`})
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {bookedCount > 0 && (
            <button
              type="button"
              onClick={() => setHideBooked((v) => !v)}
              aria-pressed={hideBooked}
              className={`rounded-sm border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                hideBooked
                  ? "border-rose-500/60 bg-rose-500/15 text-rose-200"
                  : "border-zinc-700 bg-zinc-950/60 text-zinc-300 hover:border-rose-500/50"
              }`}
              title={
                hideBooked
                  ? "Currently hiding listings flagged as booked"
                  : "Hide listings flagged as booked for your trip dates"
              }
            >
              {hideBooked ? "✓ Booked hidden" : "Hide booked"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="rounded-sm border border-rose-500/40 bg-rose-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-rose-200 transition hover:bg-rose-500/20"
          >
            Review one-by-one
          </button>
          <div
            role="radiogroup"
            aria-label="Sort listings"
            className="flex items-center gap-1 rounded-sm border border-zinc-800 bg-zinc-950/60 p-0.5"
          >
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={`rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                  mode === m.value
                    ? "bg-rose-500/15 text-rose-200"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              View
            </span>
            <div
              role="radiogroup"
              aria-label="Grid column count"
              className="flex items-center gap-0.5 rounded-sm border border-zinc-800 bg-zinc-950/60 p-0.5"
            >
              {COLUMNS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={columns === c.value}
                  aria-label={c.aria}
                  title={c.aria}
                  onClick={() => pickColumns(c.value)}
                  className={`flex items-center justify-center rounded-sm px-2 py-1.5 transition ${
                    columns === c.value
                      ? "bg-cyan-500/15 text-cyan-200"
                      : "text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {c.value === "auto" ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider">
                      Auto
                    </span>
                  ) : (
                    <ColumnIcon count={c.label as 1 | 2 | 3} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={`sb-roster ${columns !== "auto" ? `sb-roster-cols-${columns}` : ""}`}>
        {ranked.map((l, i) => (
          <ListingCard
            key={l.id}
            listing={l}
            rank={i + 1}
            tripDates={tripDates}
            battle={battle}
          />
        ))}
        {ranked.length % 2 === 1 && (
          <div
            aria-hidden="true"
            className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt=""
              className="w-full max-w-[280px] opacity-90"
            />
          </div>
        )}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        / focus URL · Esc closes the photo viewer
      </p>
    </section>
  );
}
