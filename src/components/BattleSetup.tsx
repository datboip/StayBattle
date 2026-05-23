"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBattle } from "@/app/actions";
import { useVoter } from "@/lib/voter";

function defaultDeadline(): string {
  // Default to 3 days from now, rounded to the next hour, in local datetime-local format.
  const d = new Date(Date.now() + 3 * 24 * 60 * 60_000);
  d.setMinutes(0, 0, 0);
  // datetime-local wants YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BattleSetup() {
  const router = useRouter();
  const { voter } = useVoter();
  const [name, setName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nId = useId();
  const ciId = useId();
  const coId = useId();
  const dlId = useId();

  if (!voter) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createBattle({
        name,
        organizerId: voter.id,
        organizerName: voter.name,
        checkIn,
        checkOut,
        submissionDeadline: new Date(deadline).toISOString(),
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" width={40} height={40} />
        <div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-zinc-100">
            Start a new <span className="sb-gradient-text">battle</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Set the trip and the deadline. Crew submits Airbnbs blind until the
            deadline — then voting opens.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={nId} className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            Vacation name
          </label>
          <input
            id={nId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring break, lake house, birthday weekend…"
            maxLength={80}
            className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-400"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={ciId} className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Check-in
            </label>
            <input
              id={ciId}
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={coId} className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Check-out
            </label>
            <input
              id={coId}
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(e) => setCheckOut(e.target.value)}
              className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-400"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={dlId} className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            Submission deadline
          </label>
          <input
            id={dlId}
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-400"
          />
          <p className="text-[11px] text-zinc-400">
            When this passes, submissions close and the battle automatically
            opens to voting. You can also hit &quot;Start battle now&quot; early.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={
            isPending || !name.trim() || !checkIn || !checkOut || !deadline
          }
          className="rounded-sm bg-gradient-to-r from-emerald-400 via-cyan-500 to-rose-500 px-5 py-3 text-sm font-bold uppercase tracking-wider text-zinc-950 shadow-[0_0_30px_-5px_rgba(244,63,94,0.55)] disabled:opacity-40"
        >
          {isPending ? "Creating…" : "Start the battle"}
        </button>

        <p className="text-[11px] text-zinc-500">
          You become the <span className="text-zinc-300">organizer</span> — you
          can edit dates, advance the phase early, or reset everything.
        </p>
      </form>
    </section>
  );
}
