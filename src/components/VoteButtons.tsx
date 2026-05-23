"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { castVote } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import type { Vote } from "@/lib/types";

export function VoteButtons({
  listingId,
  votes,
  score,
}: {
  listingId: string;
  votes: Vote[];
  score: number;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isPending, startTransition] = useTransition();

  const myVote = voter ? votes.find((v) => v.voter_id === voter.id)?.value ?? 0 : 0;

  const click = (target: 1 | -1) => {
    if (!voter) return;
    const next: 1 | -1 | 0 = myVote === target ? 0 : target;
    startTransition(async () => {
      await castVote(listingId, voter.id, voter.name, next);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => click(1)}
        aria-pressed={myVote === 1}
        aria-label="Upvote"
        className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm transition focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
          myVote === 1
            ? "border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-lg shadow-emerald-500/20"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-200"
        }`}
      >
        ▲
      </button>
      <span
        aria-hidden="true"
        className={`min-w-[2ch] text-center text-sm font-semibold tabular-nums ${
          score > 0 ? "text-emerald-300" : score < 0 ? "text-rose-300" : "text-zinc-400"
        }`}
      >
        {score > 0 ? `+${score}` : score}
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => click(-1)}
        aria-pressed={myVote === -1}
        aria-label="Downvote"
        className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm transition focus-visible:ring-2 focus-visible:ring-rose-400/50 ${
          myVote === -1
            ? "border-rose-400 bg-rose-500/20 text-rose-200 shadow-lg shadow-rose-500/20"
            : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-rose-500/50 hover:text-rose-200"
        }`}
      >
        ▼
      </button>
    </div>
  );
}

export function VoterAvatars({ votes }: { votes: Vote[] }) {
  const ups = votes.filter((v) => v.value === 1);
  const downs = votes.filter((v) => v.value === -1);
  if (ups.length === 0 && downs.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
      {ups.length > 0 && (
        <span title={ups.map((v) => v.voter_name).join(", ")} className="text-emerald-300">
          ▲ {ups.map((v) => v.voter_name).join(", ")}
        </span>
      )}
      {downs.length > 0 && (
        <span title={downs.map((v) => v.voter_name).join(", ")} className="text-rose-300">
          ▼ {downs.map((v) => v.voter_name).join(", ")}
        </span>
      )}
    </div>
  );
}
