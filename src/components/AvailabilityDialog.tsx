"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  refreshAvailability,
  overrideAvailability,
  clearAvailabilityOverride,
} from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { withTripDates, type TripDates } from "@/lib/trip";
import type { Battle } from "@/lib/battle";
import type { ListingWithStats } from "@/lib/types";
import { confirmDialog } from "./Modal";

type OverrideMode = null | "available" | "unavailable";

export function AvailabilityDialog({
  listing,
  tripDates,
  battle,
  onClose,
}: {
  listing: ListingWithStats;
  tripDates: TripDates;
  battle: Battle | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [overrideMode, setOverrideMode] = useState<OverrideMode>(null);

  const isOrganizer = !!(voter && battle && voter.id === battle.organizer_id);
  const datedUrl = withTripDates(listing.url, tripDates);
  const status = listing.availability_status;
  const overrideStatus = listing.availability_override_status;
  const overridden = !!(listing.availability_override || overrideStatus);
  const checkedAt = listing.availability_checked_at
    ? new Date(listing.availability_checked_at).toLocaleString()
    : null;
  const overriddenAt = listing.availability_override_at
    ? new Date(listing.availability_override_at).toLocaleString()
    : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const recheck = () => {
    startTransition(async () => {
      await refreshAvailability(listing.id);
      router.refresh();
      onClose();
    });
  };

  const submitOverride = (target: "available" | "unavailable") => {
    if (!voter || !reason.trim()) return;
    startTransition(async () => {
      const res = await overrideAvailability(
        listing.id,
        voter.id,
        reason,
        target,
      );
      if (res.ok) {
        setReason("");
        setOverrideMode(null);
        router.refresh();
        onClose();
      }
    });
  };

  const clearOverride = async () => {
    if (!voter) return;
    const ok = await confirmDialog({
      title: "Clear the override?",
      body: "The listing goes back to whatever the automatic check says — could flip it back to its previous state.",
      confirm: "Clear override",
    });
    if (!ok) return;
    startTransition(async () => {
      await clearAvailabilityOverride(listing.id, voter.id);
      router.refresh();
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Availability details"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="sb-fight-label text-zinc-300">
              Availability check
            </p>
            <h3 className="truncate text-lg font-bold text-zinc-100">
              {listing.title || "Listing"}
            </h3>
            <p className="text-xs text-zinc-400">
              {checkedAt
                ? `Last auto-checked ${checkedAt}`
                : "Hasn't been checked yet"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-sm border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:border-rose-500/60"
          >
            esc
          </button>
        </div>

        {/* Current state banner */}
        <div
          className={`rounded-sm border px-3 py-2 text-sm ${
            overridden
              ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
              : status === "available"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
                : status === "unavailable"
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-100"
                  : "border-zinc-700 bg-zinc-900/70 text-zinc-200"
          }`}
        >
          {overridden ? (
            <>
              <p className="font-semibold">
                Organizer override:{" "}
                <span className="font-normal">
                  treated as{" "}
                  <strong>{overrideStatus ?? "available"}</strong>
                </span>
              </p>
              <p className="mt-1 text-xs italic text-amber-200">
                &ldquo;{listing.availability_override}&rdquo;
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-amber-300/70">
                by {listing.availability_override_by ?? "organizer"}
                {overriddenAt && ` · ${overriddenAt}`}
              </p>
            </>
          ) : status === "available" ? (
            <p>
              Airbnb&apos;s booking widget says these dates are{" "}
              <strong>bookable right now</strong>. This is the same call
              Airbnb&apos;s own site makes when the &ldquo;Reserve&rdquo;
              button renders — same source of truth, not a guess. Heads
              up though: &ldquo;bookable now&rdquo; doesn&apos;t mean
              &ldquo;bookable in an hour&rdquo;. Someone else can grab
              it any time. Decide fast.
            </p>
          ) : status === "unavailable" ? (
            <p>
              Airbnb&apos;s booking widget <strong>refuses these
              dates</strong>. This is the real check — same call Airbnb
              fires to decide whether to show &ldquo;Reserve&rdquo; vs
              &ldquo;Change dates&rdquo;. Common reasons: dates taken,
              minimum-stay rule, host-paused calendar, or
              request-to-book listing with no pre-approval. Click
              &ldquo;Verify on Airbnb&rdquo; to see the specific reason
              with your dates pre-filled.
            </p>
          ) : (
            <p>
              Couldn&apos;t reach Airbnb&apos;s availability endpoint
              (network blip, or they rotated the API contract). Click
              Verify on Airbnb to confirm the dates yourself, or
              Recheck to retry.
            </p>
          )}
        </div>

        {/* Edge case checklist */}
        {!overridden && (
          <div className="rounded-sm border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="mb-2 sb-fight-label text-zinc-300">
              Why the auto-check could be wrong
            </p>
            <ul className="ml-4 list-disc space-y-1.5 text-xs text-zinc-300">
              <li>
                <strong className="text-zinc-100">Minimum stay
                requirement.</strong> Big villas often require 5–7 nights
                in peak season. If your trip is shorter, Airbnb shows
                &ldquo;unavailable&rdquo; even though the dates are
                physically free. Our check can&apos;t see min-stay
                rules.
              </li>
              <li>
                <strong className="text-zinc-100">Request-to-book
                listing.</strong> Host has to approve each guest. Site
                shows it as unbookable until they pre-approve.
              </li>
              <li>
                <strong className="text-zinc-100">Stale calendar.</strong>{" "}
                Host syncs from another platform (VRBO, their own site)
                with a delay. Airbnb&apos;s copy can lag by minutes-to-hours.
              </li>
              <li>
                <strong className="text-zinc-100">Just-booked.</strong>{" "}
                Someone reserved it between our check and your visit.
              </li>
              <li>
                <strong className="text-zinc-100">Host paused /
                re-listed.</strong> Temporary block that&apos;s already
                cleared (or vice versa).
              </li>
              <li>
                <strong className="text-zinc-100">Total
                price.</strong> Cleaning fees / pet fees / Airbnb
                service fee can push a listing past your group&apos;s
                budget without affecting the &ldquo;available&rdquo;
                signal.
              </li>
            </ul>
            <p className="mt-2 text-[11px] text-zinc-400">
              The auto-check is ~80–85% reliable. Always confirm on
              Airbnb before counting on a result — that&apos;s why the
              listing title links straight to Airbnb with your dates
              pre-filled.
            </p>
          </div>
        )}

        {/* Verify on Airbnb + Recheck */}
        <div className="flex flex-wrap gap-2">
          <a
            href={datedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm border border-cyan-500/50 bg-cyan-500/15 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/25"
          >
            Verify on Airbnb ↗
          </a>
          <button
            type="button"
            onClick={recheck}
            disabled={isPending}
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider text-zinc-200 hover:border-zinc-500 disabled:opacity-40"
          >
            {isPending ? "Rechecking…" : "Recheck now"}
          </button>
        </div>

        {/* Organizer override */}
        {isOrganizer && (
          <div className="border-t border-zinc-800 pt-3">
            {overridden ? (
              <button
                type="button"
                onClick={clearOverride}
                disabled={isPending}
                className="rounded-sm border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
              >
                Clear override
              </button>
            ) : overrideMode ? (
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-amber-200">
                  Why is it{" "}
                  {overrideMode === "available"
                    ? "actually available"
                    : "actually booked"}
                  ?
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    overrideMode === "available"
                      ? "Confirmed with host directly, calendar refreshed, etc."
                      : "Min-stay 7 nights · host messaged saying booked · etc."
                  }
                  maxLength={500}
                  rows={2}
                  autoFocus
                  className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => submitOverride(overrideMode)}
                    disabled={isPending || !reason.trim()}
                    className="rounded-sm border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                  >
                    Save as {overrideMode}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideMode(null);
                      setReason("");
                    }}
                    disabled={isPending}
                    className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
                  >
                    cancel
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  The reason shows in the badge tooltip + the listing
                  card so the crew knows why this was flipped manually.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  Organizer override
                </p>
                <div className="flex flex-wrap gap-2">
                  {status !== "available" && (
                    <button
                      type="button"
                      onClick={() => setOverrideMode("available")}
                      className="rounded-sm border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20"
                    >
                      Mark available
                    </button>
                  )}
                  {status !== "unavailable" && (
                    <button
                      type="button"
                      onClick={() => setOverrideMode("unavailable")}
                      className="rounded-sm border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-rose-200 hover:bg-rose-500/20"
                    >
                      Mark booked
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Use this if you&apos;ve verified on Airbnb and the
                  auto-check is wrong. Requires a one-line reason so the
                  crew knows why.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
