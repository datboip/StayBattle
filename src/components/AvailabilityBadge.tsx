"use client";

import { useState } from "react";
import { datesKey } from "@/lib/availability";
import type { TripDates } from "@/lib/trip";
import type { Battle } from "@/lib/battle";
import type { ListingWithStats, AvailabilityStatus } from "@/lib/types";
import { AvailabilityDialog } from "./AvailabilityDialog";

/**
 * Compute the "effective" status considering an organizer override.
 * Available/unavailable in the override always wins.
 */
function effectiveStatus(listing: ListingWithStats): {
  status: AvailabilityStatus | null;
  overridden: boolean;
  overriddenTo: AvailabilityStatus | null;
} {
  if (listing.availability_override_status) {
    return {
      status: listing.availability_override_status,
      overridden: true,
      overriddenTo: listing.availability_override_status,
    };
  }
  if (listing.availability_override && !listing.availability_override_status) {
    // Legacy override — defaulted to "available".
    return { status: "available", overridden: true, overriddenTo: "available" };
  }
  return {
    status: listing.availability_status,
    overridden: false,
    overriddenTo: null,
  };
}

export function AvailabilityBadge({
  listing,
  tripDates,
  battle,
}: {
  listing: ListingWithStats;
  tripDates: TripDates;
  battle?: Battle | null;
}) {
  const [open, setOpen] = useState(false);

  if (!tripDates.checkIn || !tripDates.checkOut) return null;

  const wantKey = datesKey(tripDates.checkIn, tripDates.checkOut);
  const cachedKey = listing.availability_dates_key;
  const isStale = !cachedKey || cachedKey !== wantKey;
  const { status, overridden, overriddenTo } = effectiveStatus(listing);

  let label: string;
  let className: string;
  let dotClass: string;
  let title: string;

  if (overridden && overriddenTo === "available") {
    label = "available *";
    className =
      "border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20";
    dotClass = "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]";
    title = `Marked available by organizer: "${listing.availability_override}"`;
  } else if (overridden && overriddenTo === "unavailable") {
    label = "booked *";
    className =
      "border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20";
    dotClass = "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.7)]";
    title = `Marked booked by organizer: "${listing.availability_override}"`;
  } else if (isStale || status == null) {
    label = "checking…";
    className =
      "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500";
    dotClass = "bg-zinc-500";
    title = "Checking availability for the trip dates…";
  } else if (status === "available") {
    label = "available";
    className =
      "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20";
    dotClass = "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]";
    title =
      "Airbnb's booking widget confirms these dates are bookable. Click to verify on Airbnb anyway.";
  } else if (status === "unavailable") {
    label = "booked";
    className =
      "border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20";
    dotClass = "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.7)]";
    title =
      "Airbnb's booking widget refuses these dates (booked, min-stay, etc.). Click for details.";
  } else {
    label = "verify dates ↗";
    className =
      "border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20";
    dotClass = "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]";
    title =
      "Auto-check failed (network issue or unrecognised response). Click to verify on Airbnb directly.";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${className}`}
      >
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {label}
      </button>
      {open && (
        <AvailabilityDialog
          listing={listing}
          tripDates={tripDates}
          battle={battle ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
