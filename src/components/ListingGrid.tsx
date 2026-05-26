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
        </div>
      </div>
      <div className="sb-roster">
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
