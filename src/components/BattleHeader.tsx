"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startBattleNow,
  resetBattle,
  closeBattle,
  refreshAvailability,
} from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { formatDeadlineCountdown, type Battle } from "@/lib/battle";
import { confirmDialog } from "./Modal";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function BattleHeader({ battle }: { battle: Battle }) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(Date.now());

  // Tick every minute so the countdown stays fresh without page reloads.
  useEffect(() => {
    if (battle.phase !== "submission") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [battle.phase]);

  const isOrganizer = voter?.id === battle.organizer_id;
  const countdown = formatDeadlineCountdown(battle, now);

  const phaseLabel =
    battle.phase === "submission"
      ? { text: "submission open", dot: "bg-cyan-400 shadow-cyan-400/50" }
      : battle.phase === "voting"
        ? { text: "voting open", dot: "bg-rose-400 shadow-rose-400/50" }
        : { text: "battle closed", dot: "bg-zinc-500" };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="sb-fight-label text-zinc-400">
            <span
              aria-hidden="true"
              className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full shadow-[0_0_6px_currentColor] ${phaseLabel.dot}`}
            />
            {phaseLabel.text}
          </p>
          <h2 className="truncate text-2xl font-bold tracking-tight text-zinc-100">
            {battle.name}
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-400">
            <span>
              {fmtDate(battle.check_in)} <span className="text-zinc-600">→</span>{" "}
              {fmtDate(battle.check_out)}
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-300">organized by {battle.organizer_name}</span>
            {isOrganizer && (
              <>
                <span className="text-zinc-700">·</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await refreshAvailability();
                      router.refresh();
                    });
                  }}
                  title="Re-run the availability check on every listing using the current trip dates. Sequential + polite, ~1s per listing."
                  className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200 disabled:opacity-40"
                >
                  {isPending ? "rechecking…" : "↻ recheck all dates"}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {battle.phase === "submission" && (
            <span className="rounded-sm border border-cyan-500/40 bg-cyan-500/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-200">
              {countdown}
            </span>
          )}
          {isOrganizer && battle.phase === "submission" && (
            <button
              type="button"
              disabled={isPending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Open voting now?",
                  body: "Closes submissions for everyone and reveals all listings. You can't go back to submission phase.",
                  confirm: "Start battle",
                });
                if (!ok) return;
                startTransition(async () => {
                  await startBattleNow(voter!.id);
                  router.refresh();
                });
              }}
              className="rounded-sm border border-rose-500/50 bg-rose-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
            >
              Start battle now
            </button>
          )}
          {isOrganizer && battle.phase !== "submission" && (
            <button
              type="button"
              disabled={isPending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Close the battle?",
                  body: "Top 3 listings (by score, with ties as co-medalists) get archived to the trophy case — no comments, no exact dates. The active battle is wiped so a new one can start.",
                  confirm: "🏆 Close battle",
                });
                if (!ok) return;
                startTransition(async () => {
                  await closeBattle(voter!.id);
                  router.refresh();
                });
              }}
              className="rounded-sm border border-amber-500/50 bg-amber-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
              title="Archive winners to the trophy case, then wipe so the next trip can start"
            >
              🏆 Close battle
            </button>
          )}
          {isOrganizer && (
            <button
              type="button"
              disabled={isPending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Reset the entire battle?",
                  body: "Deletes every listing, vote, comment, and place pin. Nothing is archived. Cannot be undone.",
                  confirm: "Reset everything",
                  tone: "danger",
                });
                if (!ok) return;
                startTransition(async () => {
                  await resetBattle(voter!.id);
                  router.refresh();
                });
              }}
              className="rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:border-rose-500/60 hover:text-rose-300 disabled:opacity-40"
              title="Wipe everything and start fresh"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
