"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeListing } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { withTripDates, type TripDates } from "@/lib/trip";
import { shortDisplayName } from "@/lib/title";
import type { ListingWithStats } from "@/lib/types";
import { PhotoStrip } from "./PhotoStrip";
import { SubmissionTeaser } from "./SubmissionTeaser";
import { confirmDialog } from "./Modal";

/**
 * The "everyone's submitting in secret" phase.
 *
 * Non-owners see: a sample of shuffled photos from the whole pool + the total
 * count. No titles, no votes, no comments, no who-added-what.
 *
 * The signed-in user sees: their own submissions in full with edit/remove +
 * a sales-pitch (per-listing private note for now stored as their own
 * comment on their own listing).
 */
export function SubmissionPhase({
  listings,
  tripDates,
}: {
  listings: ListingWithStats[];
  tripDates: TripDates;
}) {
  const router = useRouter();
  const { voter } = useVoter();

  // Re-poll every 6 seconds for freshly added listings from others.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(id);
  }, [router]);

  const mine = useMemo(
    () => (voter ? listings.filter((l) => l.added_by_id === voter.id) : []),
    [listings, voter],
  );

  return (
    <section className="flex flex-col gap-6">
      {/* Current submissions teaser */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-x-3 gap-y-0.5 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="sb-fight-label whitespace-nowrap text-zinc-200">
            Current submissions · {listings.length}
          </h3>
          <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 sm:text-[10px]">
            Photos only · titles + votes hidden until battle starts
          </span>
        </div>
        <SubmissionTeaser listings={listings} />
      </div>

      {/* User's own submissions */}
      <YourSubmissions listings={mine} tripDates={tripDates} />
    </section>
  );
}

function YourSubmissions({
  listings,
  tripDates,
}: {
  listings: ListingWithStats[];
  tripDates: TripDates;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-x-3 gap-y-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="sb-fight-label whitespace-nowrap text-zinc-200">
          Your submissions · {listings.length}
        </h3>
        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 sm:text-[10px]">
          Only you can see these until the battle starts
        </span>
      </div>
      {listings.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-sm border border-dashed border-zinc-800 text-sm text-zinc-400">
          You haven&apos;t submitted any yet. Paste an Airbnb URL above.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <MySubmissionCard key={l.id} listing={l} tripDates={tripDates} />
          ))}
        </div>
      )}
    </div>
  );
}

function MySubmissionCard({
  listing,
  tripDates,
}: {
  listing: ListingWithStats;
  tripDates: TripDates;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isRemoving, startRemove] = useTransition();
  const datedUrl = withTripDates(listing.url, tripDates);
  const fullTitle = listing.title || listing.url;
  const displayName = shortDisplayName(listing.title, listing.location);

  return (
    <article className="sb-fighter-card flex flex-col">
      <div className="px-2 pt-2">
        <PhotoStrip photos={listing.photos} title={listing.title} />
      </div>
      <div className="flex flex-col gap-1 px-3 pt-3">
        <a
          href={datedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm font-bold uppercase leading-snug tracking-wide text-zinc-100 hover:underline"
          title={fullTitle}
        >
          {displayName}
        </a>
        <p className="text-xs text-zinc-400">
          {[
            listing.bedrooms != null ? `${listing.bedrooms} bd` : null,
            listing.bathrooms != null ? `${listing.bathrooms} ba` : null,
            listing.max_guests != null ? `sleeps ${listing.max_guests}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          {listing.rating != null && (
            <>
              <span className="mx-2 text-zinc-600">·</span>
              <span className="text-amber-300">★ {listing.rating.toFixed(2)}</span>
            </>
          )}
        </p>
      </div>
      <SalesPitch listing={listing} />
      <div className="mt-auto flex items-center justify-end border-t border-zinc-900 px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
        <button
          type="button"
          disabled={isRemoving}
          onClick={async () => {
            const ok = await confirmDialog({
              title: "Remove this submission?",
              body: "Only you can see this card right now — removing it takes it out of your roster for the battle.",
              confirm: "Remove",
              tone: "danger",
            });
            if (!ok) return;
            startRemove(async () => {
              await removeListing(listing.id, voter?.id ?? "");
              router.refresh();
            });
          }}
          className="text-zinc-400 hover:text-rose-300"
        >
          remove
        </button>
      </div>
    </article>
  );
}

function SalesPitch({ listing }: { listing: ListingWithStats }) {
  // For now we model "sales pitch" as the user's own comment on their own
  // listing. When voting opens, these become the first messages in the
  // listing's trash-talk thread. Clean reuse — no new schema.
  const { voter } = useVoter();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const mine = useMemo(
    () => (voter ? listing.comments.filter((c) => c.voter_id === voter.id) : []),
    [listing.comments, voter],
  );

  const submit = async () => {
    if (!voter || !body.trim()) return;
    const text = body;
    startTransition(async () => {
      const { addComment } = await import("@/app/actions");
      const res = await addComment(listing.id, voter.id, voter.name, text);
      if (res.ok) {
        setBody("");
        router.refresh();
      }
    });
  };

  const remove = async (commentId: string) => {
    if (!voter) return;
    const ok = await confirmDialog({
      title: "Delete this hype?",
      body: "Removes it from your pinned notes. The crew won't see it when voting opens.",
      confirm: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const { deleteComment } = await import("@/app/actions");
      await deleteComment(commentId, voter.id);
      router.refresh();
    });
  };

  return (
    <div className="border-t border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent px-3 py-2.5">
      <p className="sb-fight-label mb-2 flex items-center gap-1.5 text-amber-200">
        <span aria-hidden="true">📌</span> Your hype
      </p>
      {mine.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {mine.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-sm border-l-2 border-amber-400/60 bg-amber-500/5 px-2 py-1.5 text-xs text-zinc-100"
            >
              <span className="min-w-0 flex-1 break-words">{c.body}</span>
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={isPending}
                aria-label="Delete this hype"
                title="Delete this hype"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900/80 text-sm leading-none text-zinc-300 transition hover:border-rose-500/60 hover:bg-rose-500/15 hover:text-rose-200 disabled:opacity-40"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Why this one? Your one-liner stays pinned…"
          maxLength={2000}
          aria-label="Your hype for this listing"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="flex-1 rounded-sm border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
        />
        <button
          type="button"
          disabled={isPending || !body.trim()}
          onClick={submit}
          className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs uppercase tracking-wider text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
        >
          pin
        </button>
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">
        Pinned at the top of the comments when the battle opens — your opening
        argument before anyone else weighs in.
      </p>
    </div>
  );
}
