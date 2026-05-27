"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { castVote } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import type { Vote, VoteValue } from "@/lib/types";
import { RatingSlider } from "./RatingSlider";

/**
 * Grid-card vote control. Compact 1-5 slider. The voter's current rating
 * is the slider's committed value; drag-and-release sends a new vote.
 */
export function VoteButtons({
  listingId,
  votes,
  score,
  addedById,
}: {
  listingId: string;
  votes: Vote[];
  score: number | null;
  /** Voter id of the user who submitted this listing. When this matches
   *  the signed-in voter, the slider is locked — submitters can't rate
   *  their own listings (the 1–5 scale doesn't dampen self-5s). */
  addedById?: string | null;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isPending, startTransition] = useTransition();

  const isOwnSubmission = !!voter && !!addedById && voter.id === addedById;

  const myVote: VoteValue | null = voter
    ? (votes.find((v) => v.voter_id === voter.id)?.value ?? null)
    : null;

  const handleCommit = (next: VoteValue) => {
    if (!voter || isOwnSubmission) return;
    startTransition(async () => {
      await castVote(listingId, voter.id, voter.name, next);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {isOwnSubmission ? (
        <div className="rounded-sm border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          Your submission · can't rate your own
        </div>
      ) : (
      <RatingSlider
        value={myVote}
        onCommit={handleCommit}
        size="compact"
        disabled={isPending || !voter}
      />
      )}
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-500">
        <span>
          {votes.length === 0
            ? "No ratings yet"
            : `${votes.length} ${votes.length === 1 ? "rating" : "ratings"}`}
        </span>
        {score !== null && (
          <span className="font-semibold tabular-nums text-zinc-300">
            mean {score.toFixed(1)} <span className="text-zinc-600">/ 5</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Compact roster of who voted, each with their rating. Sorted high → low. */
export function VoterAvatars({ votes }: { votes: Vote[] }) {
  if (votes.length === 0) return null;
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
