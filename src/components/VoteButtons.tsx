"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { castVote } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import type { Vote, VoteValue } from "@/lib/types";

// Five-pill rating (Pattern C, compact). Tap a pill to rate, tap the
// selected pill again to clear. Each pill's selected color follows the
// brand spectrum: 1 = rose, 5 = teal, 2-4 interpolate.
const COMPACT_LABELS: Array<{ value: VoteValue; label: string }> = [
  { value: 1, label: "No" },
  { value: 2, label: "Meh" },
  { value: 3, label: "OK" },
  { value: 4, label: "Like" },
  { value: 5, label: "Love" },
];

const SELECTED_BG: Record<VoteValue, string> = {
  1: "border-[#FF6C51] bg-[#FF6C51] text-[#2a0808]",
  2: "border-[#b85240] bg-[#b85240] text-white",
  3: "border-zinc-500 bg-zinc-500 text-zinc-50",
  4: "border-[#0a8a92] bg-[#0a8a92] text-white",
  5: "border-[#10C8D2] bg-[#10C8D2] text-[#052a31]",
};

export function VoteButtons({
  listingId,
  votes,
  score,
}: {
  listingId: string;
  votes: Vote[];
  score: number | null;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isPending, startTransition] = useTransition();

  const myVote: VoteValue | 0 = voter
    ? (votes.find((v) => v.voter_id === voter.id)?.value ?? 0)
    : 0;

  const click = (target: VoteValue) => {
    if (!voter) return;
    const next: 0 | VoteValue = myVote === target ? 0 : target;
    startTransition(async () => {
      await castVote(listingId, voter.id, voter.name, next);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {COMPACT_LABELS.map(({ value, label }) => {
          const selected = myVote === value;
          return (
            <button
              key={value}
              type="button"
              disabled={isPending}
              onClick={() => click(value)}
              aria-pressed={selected}
              aria-label={`Rate ${value} out of 5`}
              className={`flex-1 rounded-md border px-1 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition focus-visible:ring-2 focus-visible:ring-[#10C8D2]/50 disabled:opacity-50 ${
                selected
                  ? SELECTED_BG[value]
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-500">
        <span>
          {votes.length === 0
            ? "No ratings yet"
            : `${votes.length} ${votes.length === 1 ? "rating" : "ratings"}`}
        </span>
        {score !== null && (
          <span className="font-semibold tabular-nums text-zinc-300">
            {score.toFixed(1)} <span className="text-zinc-600">/ 5</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Compact roster of who voted, with their rating in a tiny pill. */
export function VoterAvatars({ votes }: { votes: Vote[] }) {
  if (votes.length === 0) return null;
  // Sort by rating desc so the most enthusiastic voters show first.
  const sorted = [...votes].sort((a, b) => b.value - a.value);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
      {sorted.map((v) => (
        <span
          key={v.voter_id}
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${valueClass(v.value)}`}
          title={`${v.voter_name} rated ${v.value}/5`}
        >
          <span className="opacity-70">{v.value}</span>
          <span>{v.voter_name}</span>
        </span>
      ))}
    </div>
  );
}

function valueClass(v: number): string {
  if (v >= 5) return "border-[#10C8D2]/40 text-[#10C8D2]";
  if (v >= 4) return "border-[#0a8a92]/40 text-[#5fb8be]";
  if (v >= 3) return "border-zinc-500/40 text-zinc-300";
  if (v >= 2) return "border-[#b85240]/40 text-[#d77a6a]";
  return "border-[#FF6C51]/40 text-[#FF6C51]";
}
