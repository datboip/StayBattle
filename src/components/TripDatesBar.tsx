"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTripDates } from "@/app/actions";
import type { TripDates } from "@/lib/trip";

function nights(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 86_400_000);
}

function fmt(iso: string): string {
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

export function TripDatesBar({ dates }: { dates: TripDates }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [ci, setCi] = useState(dates.checkIn ?? "");
  const [co, setCo] = useState(dates.checkOut ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ciId = useId();
  const coId = useId();

  const save = (newIn: string, newOut: string) => {
    setErr(null);
    startTransition(async () => {
      const res = await setTripDates(newIn, newOut);
      if (!res.ok) setErr(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  };

  const clear = () => {
    setCi("");
    setCo("");
    save("", "");
  };

  const n = nights(dates.checkIn, dates.checkOut);

  if (!editing && dates.checkIn && dates.checkOut) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm">
        <span className="sb-fight-label text-zinc-300">Trip dates</span>
        <span className="text-zinc-100">
          {fmt(dates.checkIn)} <span className="text-zinc-500">→</span> {fmt(dates.checkOut)}
        </span>
        {n != null && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            {n} night{n === 1 ? "" : "s"}
          </span>
        )}
        <span className="grow" />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:text-rose-300"
        >
          edit
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={isPending}
          className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 hover:text-rose-300 disabled:opacity-40"
        >
          clear
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(ci, co);
      }}
      className="flex flex-wrap items-end gap-2 rounded-sm border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
    >
      <span className="sb-fight-label mr-1 text-zinc-300">Trip dates</span>
      <div className="flex flex-col">
        <label htmlFor={ciId} className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          Check-in
        </label>
        <input
          id={ciId}
          type="date"
          value={ci}
          onChange={(e) => setCi(e.target.value)}
          className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-rose-400"
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor={coId} className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          Check-out
        </label>
        <input
          id={coId}
          type="date"
          value={co}
          min={ci || undefined}
          onChange={(e) => setCo(e.target.value)}
          className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-rose-400"
        />
      </div>
      <button
        type="submit"
        disabled={isPending || (!ci && !co)}
        className="rounded-sm border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {(dates.checkIn || dates.checkOut) && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-100"
        >
          cancel
        </button>
      )}
      {err && (
        <p role="alert" className="basis-full text-sm text-rose-400">
          {err}
        </p>
      )}
      {!dates.checkIn && !dates.checkOut && (
        <p className="basis-full text-xs text-zinc-400">
          Setting dates appends them to every Airbnb link so clicking through goes straight to your trip window.
        </p>
      )}
    </form>
  );
}
