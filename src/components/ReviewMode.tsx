"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { castVote, addComment } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { withTripDates, type TripDates } from "@/lib/trip";
import type { ListingWithStats, VoteValue } from "@/lib/types";
import { PhotoStrip } from "./PhotoStrip";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { RatingSlider } from "./RatingSlider";
import { shortDisplayName } from "@/lib/title";
import type { Battle } from "@/lib/battle";

/**
 * One-at-a-time review of every listing. Swipe-through review: see big card →
 * leave a comment if you want → rate 1-5 / skip → next. Unvoted-by-you first,
 * then the rest, so a returning user lands on something new.
 */
export function ReviewMode({
  listings,
  tripDates,
  battle,
  onClose,
}: {
  listings: ListingWithStats[];
  tripDates: TripDates;
  battle?: Battle | null;
  onClose: () => void;
}) {
  const { voter } = useVoter();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [submitting, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const stableOrderRef = useRef<ListingWithStats[]>([]);

  // Compute a fixed order on first render: unseen first, then seen.
  // We don't recompute when votes update mid-session — that would
  // shuffle the deck under the user.
  useMemo(() => {
    if (stableOrderRef.current.length > 0) return;
    if (!voter) {
      stableOrderRef.current = [...listings];
      return;
    }
    const unseen: ListingWithStats[] = [];
    const seen: ListingWithStats[] = [];
    for (const l of listings) {
      const hasVote = l.votes.some((v) => v.voter_id === voter.id);
      const hasComment = l.comments.some((c) => c.voter_id === voter.id);
      if (hasVote || hasComment) seen.push(l);
      else unseen.push(l);
    }
    stableOrderRef.current = [...unseen, ...seen];
  }, [voter, listings]);

  // Keep stale order on rerenders, but reflect freshly-cast votes so the
  // current card shows updated vote state.
  const order = useMemo(() => {
    return stableOrderRef.current.map(
      (l) => listings.find((x) => x.id === l.id) ?? l,
    );
  }, [listings]);

  const current = order[index];
  const total = order.length;

  // Reset draft when we move to a new card.
  useEffect(() => {
    setDraft("");
  }, [index]);

  // Keyboard shortcuts inside review mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // Don't hijack typing keys when the comment box is focused.
      if (inField) return;

      // Number keys 1-5 cast that rating directly. ArrowUp / ArrowDown
      // keep working as shortcuts for 5 (Love) / 1 (Nope) so muscle memory
      // from the old thumb-up/down UI doesn't have to relearn.
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        vote(Number(e.key) as VoteValue);
      } else if (e.key === "ArrowUp" || e.key === "u" || e.key === "U") {
        e.preventDefault();
        vote(5);
      } else if (e.key === "ArrowDown" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        vote(1);
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const myVote = (() => {
    if (!voter || !current) return 0;
    return current.votes.find((v) => v.voter_id === voter.id)?.value ?? 0;
  })();

  const isOwnSubmission =
    !!voter && !!current && current.added_by_id === voter.id;

  const goNext = () => {
    if (index >= total - 1) return;
    setIndex((i) => i + 1);
  };
  const goPrev = () => {
    if (index <= 0) return;
    setIndex((i) => i - 1);
  };

  const vote = (target: VoteValue) => {
    if (!voter || !current || isOwnSubmission) return;
    const next: 0 | VoteValue = myVote === target ? 0 : target;
    startTransition(async () => {
      await castVote(current.id, voter.id, voter.name, next);
      router.refresh();
    });
  };

  // Vote + slide-off animation + auto-advance. Used by the big labelled
  // buttons. Keyboard shortcuts (1-5, ArrowUp/Down) call vote() without
  // advancing — handy for correcting yourself before moving on.
  //
  // Slide direction follows sentiment: 1-2 swipe left (rejection), 3 stays
  // centered, 4-5 swipe right (endorsement). A middle "3" still advances
  // but without the swipe; feels appropriate for a neutral verdict.
  const voteAndNext = (target: VoteValue) => {
    if (!voter || !current || swipeDir || isOwnSubmission) return;
    const dir = target >= 4 ? "right" : target <= 2 ? "left" : null;
    if (dir) setSwipeDir(dir);
    const next: 0 | VoteValue = myVote === target ? 0 : target;
    startTransition(async () => {
      await castVote(current.id, voter.id, voter.name, next);
      router.refresh();
    });
    setTimeout(() => {
      setSwipeDir(null);
      if (index < total - 1) setIndex((i) => i + 1);
    }, 280);
  };

  const postComment = async () => {
    if (!voter || !current || !draft.trim()) return;
    const text = draft;
    startTransition(async () => {
      const res = await addComment(current.id, voter.id, voter.name, text);
      if (res.ok) {
        setDraft("");
        router.refresh();
      }
    });
  };

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-zinc-800 py-20 text-center">
        <p className="sb-fight-label text-zinc-300">no contenders to review</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-zinc-700 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-200 hover:border-rose-500/60"
        >
          back to roster
        </button>
      </div>
    );
  }

  const datedUrl = withTripDates(current.url, tripDates);
  const fullTitle = current.title || current.url;
  const displayName = shortDisplayName(current.title, current.location);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="sb-fight-label text-zinc-200">
            Review · {index + 1} of {total}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            ↑/↓ vote · → next · esc exit
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-zinc-700 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-200 hover:border-rose-500/60"
        >
          back to roster
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-rose-500 transition-[width]"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <article
        key={current.id}
        className={`sb-fighter-card sb-review-card mx-auto flex w-full max-w-3xl flex-col${swipeDir === "left" ? " sb-swipe-left" : swipeDir === "right" ? " sb-swipe-right" : ""}`}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <a
            href={datedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-1 font-bold uppercase tracking-wide text-zinc-100 hover:underline"
            title={fullTitle}
          >
            {displayName}
          </a>
          <span
            className={`rounded-sm border px-2 py-0.5 font-mono text-sm font-bold tabular-nums ${
              current.score == null
                ? "border-zinc-700 text-zinc-500"
                : current.score >= 4
                  ? "border-[#10C8D2]/70 text-[#10C8D2]"
                  : current.score >= 3
                    ? "border-zinc-600 text-zinc-200"
                    : "border-[#FF6C51]/70 text-[#FF6C51]"
            }`}
            title={current.score == null ? "No ratings yet" : `Mean of ${current.vote_count} rating${current.vote_count === 1 ? "" : "s"}`}
          >
            {current.score == null ? "—" : `${current.score.toFixed(1)} / 5`}
          </span>
        </div>

        <div className="flex items-center gap-2 px-4">
          {current.location && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              {current.location}
            </p>
          )}
          <AvailabilityBadge listing={current} tripDates={tripDates} battle={battle} />
        </div>

        <div className="px-3 pt-3">
          <PhotoStrip photos={current.photos} title={current.title} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 py-3 font-mono text-xs sm:grid-cols-4">
          <Stat label="Bedrooms" value={current.bedrooms ?? "—"} />
          <Stat label="Bathrooms" value={current.bathrooms ?? "—"} />
          <Stat label="Beds" value={current.beds ?? "—"} />
          <Stat label="Sleeps" value={current.max_guests ?? "—"} />
          {current.rating != null && (
            <Stat
              label="Rating"
              value={
                <span className="text-amber-300">
                  ★ {current.rating.toFixed(2)}
                  {current.review_count != null && (
                    <span className="ml-1 text-zinc-500">({current.review_count})</span>
                  )}
                </span>
              }
            />
          )}
        </div>

        {/* Existing trash talk on this listing */}
        {current.comments.length > 0 && (
          <div className="border-t border-zinc-900 px-4 py-3">
            <p className="sb-fight-label mb-2 text-zinc-300">
              Trash talk so far
            </p>
            <ul className="flex flex-col gap-1.5">
              {current.comments.slice(-4).map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-rose-300">
                    {c.voter_name}
                  </span>
                  <span className="text-zinc-200">{c.body}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comment input */}
        <div className="flex gap-2 border-t border-zinc-900 px-4 py-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Throw a jab on the way out…"
            maxLength={2000}
            aria-label="Add a comment about this listing"
            className="flex-1 rounded-sm border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                postComment();
              }
            }}
          />
          <button
            type="button"
            onClick={postComment}
            disabled={submitting || !draft.trim()}
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-100 hover:border-rose-500 disabled:opacity-40"
          >
            post
          </button>
        </div>

        {/* Vote bar — Radix slider drag-and-release to rate, auto-advance
            on commit. If the voter already rated this listing, the slider
            shows their current rating and the big right-side button
            switches from "Skip →" to "Keep N · Next →" so they can advance
            without re-touching the slider. */}
        <div className="border-t border-zinc-900 px-4 py-4">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <span>{isOwnSubmission ? "Your submission" : "What's the verdict?"}</span>
            <button
              type="button"
              onClick={goNext}
              className={`rounded-sm border px-3 py-1.5 transition ${
                myVote
                  ? "border-[#10C8D2]/60 bg-[#10C8D2]/10 text-[#10C8D2] hover:bg-[#10C8D2]/20"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
              }`}
              title={
                isOwnSubmission
                  ? "Can't rate your own listing — advance to next"
                  : myVote
                    ? `Already rated ${myVote}/5 — advance to next listing`
                    : "Move to next listing without rating"
              }
            >
              {isOwnSubmission ? "Next →" : myVote ? `Keep ${myVote} · Next →` : "Skip →"}
            </button>
          </div>
          {isOwnSubmission ? (
            <div className="rounded-sm border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              You added this one · can't rate your own submission
            </div>
          ) : (
            <>
              <RatingSlider
                value={myVote === 0 ? null : myVote}
                onCommit={(v) => voteAndNext(v)}
                size="large"
                disabled={submitting || swipeDir !== null}
              />
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                ← → arrows · 1-5 keys rate · space skips
              </p>
            </>
          )}
        </div>

        {/* Navigation footer */}
        <div className="flex items-center justify-between border-t border-zinc-900 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className="hover:text-zinc-100 disabled:opacity-30"
          >
            ← back
          </button>
          {index === total - 1 ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200 hover:bg-emerald-500/20"
            >
              Done — see the roster
            </button>
          ) : (
            <button type="button" onClick={goNext} className="hover:text-zinc-100">
              next →
            </button>
          )}
        </div>
      </article>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-zinc-900 py-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <span className="font-semibold text-zinc-100">{value}</span>
    </div>
  );
}
