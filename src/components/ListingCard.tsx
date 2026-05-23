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

  const scoreClass =
    listing.score > 0
      ? "text-emerald-200 border-emerald-400/70 shadow-[0_0_20px_-5px_rgba(52,211,153,0.6)]"
      : listing.score < 0
        ? "text-rose-200 border-rose-400/70 shadow-[0_0_20px_-5px_rgba(244,63,94,0.6)]"
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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3 z-10 rotate-[-8deg] rounded-sm border-2 border-rose-500/80 bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-rose-200 shadow-[0_0_20px_-5px_rgba(244,63,94,0.5)]"
        >
          Booked
        </div>
      )}
      {/* Top band: rank + score */}
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <span className="font-mono text-2xl font-black leading-none text-zinc-100">
          <span className="text-zinc-500">#</span>
          {String(rank).padStart(2, "0")}
        </span>
        <span
          aria-label={`Score: ${listing.score}`}
          className={`rounded-sm border px-2 py-0.5 font-mono text-sm font-bold tabular-nums ${scoreClass}`}
        >
          {listing.score > 0 ? `+${listing.score}` : listing.score}
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

      {/* Identity */}
      <div className="flex flex-col gap-0.5 px-3 pt-3">
        <a
          href={datedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm font-bold uppercase leading-snug tracking-wide text-zinc-100 hover:underline"
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

      {/* Vote bar */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-900 px-3 py-3">
        <VoteButtons listingId={listing.id} votes={listing.votes} score={listing.score} />
        <button
          type="button"
          onClick={() => setOpenTalk((o) => !o)}
          className="sb-fight-label rounded-sm border border-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:border-rose-500/50 hover:text-rose-200"
          aria-expanded={openTalk}
          aria-controls={`talk-${listing.id}`}
        >
          trash talk · {listing.comments.length}
        </button>
      </div>

      <div className="px-3 pb-2">
        <VoterAvatars votes={listing.votes} />
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
