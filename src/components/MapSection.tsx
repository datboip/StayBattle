"use client";

import dynamic from "next/dynamic";
import type { ListingWithStats, Place } from "@/lib/types";
import type { TripDates } from "@/lib/trip";
import { AddPlaceForm } from "./AddPlaceForm";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-700 text-sm text-zinc-400">
      Loading map…
    </div>
  ),
});

export function MapSection({
  listings,
  places,
  tripDates,
}: {
  listings: ListingWithStats[];
  places: Place[];
  tripDates: TripDates;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-y-1">
        <h2 className="sb-fight-label text-zinc-200">Battle map</h2>
        <span className="text-xs text-zinc-400">
          <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400 align-middle" />
          listing
          <span aria-hidden="true" className="mx-2 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />
          reference
        </span>
      </div>
      <AddPlaceForm />
      <MapView listings={listings} places={places} tripDates={tripDates} />
    </section>
  );
}
