"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeListing } from "@/app/actions";
import { PhotoStrip } from "./PhotoStrip";
import { VoteButtons, VoterAvatars } from "./VoteButtons";
import { Comments } from "./Comments";
import { Lightbox } from "./Lightbox";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { withTripDates, type TripDates } from "@/lib/trip";
import { shortDisplayName } from "@/lib/title";
import { confirmDialog } from "./Modal";
import type { ListingWithStats } from "@/lib/types";
import type { Battle } from "@/lib/battle";

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="sb-stat-row">
      <span className="sb-stat-label">{label}</span>
      <span className="sb-stat-value">{value}</span>
    </div>
  );
}

export function ListingCard({
  listing,
  rank,
  tripDates,
  battle,
}: {
  listing: ListingWithStats;
  rank: number;
  tripDates: TripDates;
  battle?: Battle | null;
}) {
  const router = useRouter();
  const [isRemoving, startRemove] = useTransition();
  const [openTalk, setOpenTalk] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Color the score chip along the brand spectrum. Score is now a 1–5 mean
  // (or null when no one has voted yet). 4.0+ is teal-positive, ≤2.0 is
  // rose-negative, in-between is neutral. Null shows a muted dash.
  const scoreClass =
    listing.score == null
      ? "text-zinc-500 border-zinc-700"
      : listing.score >= 4
        ? "text-[#10C8D2] border-[#10C8D2]/70 shadow-[0_0_20px_-5px_rgba(16,200,210,0.6)]"
        : listing.score <= 2
          ? "text-[#FF6C51] border-[#FF6C51]/70 shadow-[0_0_20px_-5px_rgba(255,108,81,0.6)]"
          : "text-zinc-200 border-zinc-700";

  const fullTitle = listing.title || listing.url;
  const displayName = shortDisplayName(listing.title, listing.location);
  const datedUrl = withTripDates(listing.url, tripDates);
  const disqualified =
    listing.availability_status === "unavailable" &&
    !listing.availability_override;

  return (
    <article
      className={`sb-fighter-card relative flex flex-col transition ${
        disqualified ? "opacity-60 saturate-50 hover:opacity-90" : ""
      }`}
      aria-label={disqualified ? `${displayName} (booked for your dates)` : displayName}
    >
      {disqualified && (
        // GTA "Wasted" / rejected-rubber-stamp treatment: full-card overlay
        // with a big rotated BOOKED label dead center, double-border like a
        // real ink stamp, rose glow. Above all card content (z-20). Backdrop
        // is barely tinted so the listing photo still reads through.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-rose-950/20"
        >
          <span
            className="select-none rotate-[-10deg] border-[6px] border-[#FF6C51] bg-[#FF6C51]/15 px-6 py-3 font-mono text-4xl font-black uppercase tracking-[0.18em] text-[#FF6C51] shadow-[0_0_40px_-5px_rgba(255,108,81,0.6)] sm:text-5xl"
            style={{
              textShadow:
                "0 2px 8px rgba(255,108,81,0.8), 0 0 24px rgba(255,108,81,0.5)",
              boxShadow:
                "0 0 40px -5px rgba(255,108,81,0.6), inset 0 0 8px rgba(255,108,81,0.3), 0 0 0 2px rgba(255,108,81,0.4), 0 0 0 12px transparent, 0 0 0 14px rgba(255,108,81,0.2)",
            }}
          >
            Booked
          </span>
        </div>
      )}
      {/* Top band: rank + score */}
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <span className="font-mono text-2xl font-black leading-none text-zinc-100">
          <span className="text-zinc-500">#</span>
          {String(rank).padStart(2, "0")}
        </span>
        <span
          aria-label={listing.score == null ? "No ratings yet" : `Mean rating: ${listing.score.toFixed(1)} of 5`}
          className={`rounded-sm border px-2 py-0.5 font-mono text-sm font-bold tabular-nums ${scoreClass}`}
          title={listing.score == null ? "Not yet rated" : `Mean of ${listing.vote_count} rating${listing.vote_count === 1 ? "" : "s"}`}
        >
          {listing.score == null ? "—" : listing.score.toFixed(1)}
        </span>
      </div>

      {/* Photo */}
      <div className="px-2">
        <PhotoStrip
          photos={listing.photos}
          title={listing.title}
          onPhotoClick={(i) => setLightboxIndex(i)}
        />
      </div>

      {/* Identity — title reserves 2 lines of space whether the text fills
          them or not, so cards line up across the grid regardless of title
          length. min-height matches 2 × line-height of the size (snug
          leading on text-sm = ~1.375 × 14px = ~19.25px → 2 lines ≈ 38.5px). */}
      <div className="flex flex-col gap-0.5 px-3 pt-3">
        <a
          href={datedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 min-h-[2.75rem] text-sm font-bold uppercase leading-snug tracking-wide text-zinc-100 hover:underline"
          title={fullTitle}
        >
          {displayName}
        </a>
        <div className="mt-1">
          <AvailabilityBadge listing={listing} tripDates={tripDates} battle={battle} />
        </div>
      </div>

      {/* Stat slab */}
      <div className="mx-3 mt-3 rounded-sm border border-zinc-800 bg-zinc-950/70">
        <StatRow label="Bedrooms" value={listing.bedrooms ?? "—"} />
        <StatRow label="Bathrooms" value={listing.bathrooms ?? "—"} />
        <StatRow label="Beds" value={listing.beds ?? "—"} />
        <StatRow label="Sleeps" value={listing.max_guests ?? "—"} />
        <StatRow
          label="Rating"
          value={
            listing.rating != null ? (
              <span className="text-amber-300">
                ★ {listing.rating.toFixed(2)}
                {listing.review_count != null && (
                  <span className="ml-1 text-zinc-400">({listing.review_count})</span>
                )}
              </span>
            ) : (
              "—"
            )
          }
        />
      </div>

      {/* Vote bar — pills get their own full-width row so all 5 labels stay
          legible. Trash-talk toggle sits on its own row below, sharing space
          with the voter-avatars chip cloud. */}
      <div className="mt-3 border-t border-zinc-900 px-3 py-3">
        <VoteButtons
          listingId={listing.id}
          votes={listing.votes}
          score={listing.score}
          addedById={listing.added_by_id}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2">
        <VoterAvatars votes={listing.votes} />
        <button
          type="button"
          onClick={() => setOpenTalk((o) => !o)}
          className="sb-fight-label ml-auto rounded-sm border border-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:border-rose-500/50 hover:text-rose-200"
          aria-expanded={openTalk}
          aria-controls={`talk-${listing.id}`}
        >
          trash talk · {listing.comments.length}
        </button>
      </div>

      {openTalk && (
        <div
          id={`talk-${listing.id}`}
          className="border-t border-zinc-900 px-3 pb-2 pt-2"
        >
          <Comments
            listingId={listing.id}
            comments={listing.comments}
            ownerId={listing.added_by_id}
          />
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-zinc-900 px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="text-zinc-400">by {listing.added_by_name || "anon"}</span>
        <button
          type="button"
          disabled={isRemoving}
          onClick={async () => {
            const ok = await confirmDialog({
              title: "Eliminate this contender?",
              body: "It disappears for everyone in the battle. This can't be undone.",
              confirm: "Eliminate",
              tone: "danger",
            });
            if (!ok) return;
            startRemove(async () => {
              await removeListing(listing.id, "");
              router.refresh();
            });
          }}
          aria-label={`Eliminate ${displayName}`}
          className="text-zinc-400 hover:text-rose-300"
        >
          eliminate
        </button>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={listing.photos}
          startIndex={lightboxIndex}
          alt={displayName}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </article>
  );
}
