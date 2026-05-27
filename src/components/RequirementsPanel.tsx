"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useVoter } from "@/lib/voter";
import { setBattleRequirements } from "@/app/actions";
import { AMENITY_TAGS, type AmenityTag } from "@/lib/airbnb-graphql";
import { AMENITY_LABELS } from "@/lib/requirements";
import type { Battle } from "@/lib/battle";

/**
 * Organizer-only "must-haves" editor. Toggleable chip per amenity;
 * empty selection = no requirements (the row disappears from cards).
 *
 * Sits collapsed by default so it doesn't dominate the voting page;
 * organizers expand it once at the start of a battle and forget about
 * it. Non-organizers don't see it at all.
 */
export function RequirementsPanel({
  battle,
  initialRequirements,
}: {
  battle: Battle;
  initialRequirements: AmenityTag[];
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<AmenityTag>>(
    () => new Set(initialRequirements),
  );
  const [saving, startSaving] = useTransition();

  if (!voter || voter.id !== battle.organizer_id) return null;

  const toggle = (tag: AmenityTag) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const save = () => {
    startSaving(async () => {
      await setBattleRequirements(voter.id, Array.from(selected));
      router.refresh();
    });
  };

  const reset = () => {
    setSelected(new Set(initialRequirements));
  };

  const dirty = (() => {
    if (selected.size !== initialRequirements.length) return true;
    for (const t of initialRequirements) if (!selected.has(t)) return true;
    return false;
  })();

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            Must-haves
          </span>
          {initialRequirements.length > 0 && (
            <span className="rounded-sm border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">
              {initialRequirements.length}
            </span>
          )}
          {initialRequirements.length === 0 && (
            <span className="font-mono text-[10px] text-zinc-600">
              none set
            </span>
          )}
        </span>
        <span aria-hidden="true" className="text-zinc-500">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-900 px-4 py-3">
          <p className="mb-2 text-xs leading-relaxed text-zinc-400">
            Pick what every listing needs. Each card will show a green
            check or a "Missing: X" line against this list. Toggle off
            to keep it from showing up at all.
          </p>
          <div role="group" className="flex flex-wrap gap-1.5">
            {AMENITY_TAGS.map((tag) => {
              const on = selected.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    on
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  <span aria-hidden="true">{on ? "✓" : "+"}</span>
                  <span>{AMENITY_LABELS[tag]}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={!dirty || saving}
              className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-sm border border-cyan-500/60 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save must-haves"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
