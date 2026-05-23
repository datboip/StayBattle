"use client";

import { useEffect, useRef, useState } from "react";
import { useVoter } from "@/lib/voter";
import { confirmDialog } from "./Modal";
import { ThemeToggle } from "./ThemeToggle";
import { HelpButton } from "./HelpModal";
import type { Battle } from "@/lib/battle";

export function HeaderBar({ battle }: { battle?: Battle | null }) {
  const { voter, signOut } = useVoter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!voter) return null;
  return (
    <header className="flex flex-col gap-2">
      {/* Banner is its own row — full width, big. */}
      <h1 className="m-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-banner.png"
          alt="StayBattle — settle the vacation argument"
          className="h-20 w-auto sm:h-28 md:h-32"
        />
      </h1>

      {/* Second row: disclaimer (left) shares the line with the
          controls (right) so they read as one bar instead of two
          stacks. Matches the pre-banner layout's visual rhythm. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[9px] uppercase tracking-wider text-zinc-600">
          Unaffiliated with Airbnb, Inc.
        </p>

        <div className="ml-auto flex items-center gap-2">
          <HelpButton battle={battle} />
          <ThemeToggle />
          <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`Signed in as ${voter.name}. Open account menu.`}
            className="group flex max-w-[50vw] items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-100 backdrop-blur hover:border-rose-500/60 sm:max-w-none"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
            />
            <span className="truncate">{voter.name}</span>
            <span aria-hidden="true" className="text-zinc-500">▾</span>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-sm border border-zinc-700 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur"
              style={{
                // Belt + suspenders: if for any reason the menu would still
                // overflow to the left, this nudges it back into the viewport.
                maxWidth: "min(14rem, calc(100vw - 1.5rem))",
              }}
            >
              <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Signed in as
                <p className="mt-0.5 truncate font-sans text-sm font-medium normal-case tracking-normal text-zinc-100">
                  {voter.name}
                </p>
              </div>

              {battle && battle.organizer_id === voter.id && (
                <div className="border-t border-zinc-800 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  Organizing
                  <p
                    className="mt-0.5 truncate font-sans text-sm font-medium normal-case tracking-normal text-cyan-300"
                    title={battle.name}
                  >
                    {battle.name}
                  </p>
                </div>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: "Sign out?",
                    body: "You'll need your name + PIN to come back.",
                    confirm: "Sign out",
                    tone: "danger",
                  });
                  if (!ok) return;
                  signOut();
                  setOpen(false);
                }}
                className="w-full rounded-sm px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10"
              >
                Sign out
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
        <span className="sb-fight-label text-zinc-400">tonight&apos;s main card</span>
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
      </div>
    </header>
  );
}
