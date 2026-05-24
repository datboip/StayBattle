"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPlace } from "@/app/actions";
import { useVoter } from "@/lib/voter";

export function AddPlaceForm() {
  const router = useRouter();
  const { voter } = useVoter();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voter || !q.trim()) return;
    const value = q;
    setError(null);
    startTransition(async () => {
      const res = await addPlace(value, voter.name);
      if (!res.ok) setError(res.error);
      else {
        setQ("");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor={inputId} className="sr-only">
        Place to pin (landmark, address, or maps link)
      </label>
      <input
        id={inputId}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder='Drop a landmark: "Balboa Park", a maps link, an address…'
        className="flex-1 rounded-sm border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
      />
      <button
        type="submit"
        disabled={isPending || !q.trim()}
        className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
      >
        {isPending ? "Finding…" : "Pin place"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-rose-400 sm:basis-full sm:mt-1">
          {error}
        </p>
      )}
    </form>
  );
}
