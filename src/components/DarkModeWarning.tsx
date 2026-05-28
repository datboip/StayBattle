"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import type { Battle } from "@/lib/battle";

/**
 * Catches clicks on any Airbnb link anywhere on the page and pops a
 * dark-mode-aware warning modal before opening the link. Only triggers
 * when:
 *   1. User is in dark mode (light-mode users skip entirely — Airbnb is
 *      light too, no contrast shock)
 *   2. User hasn't ticked "don't show again" for this battle
 *   3. The click is a plain left-click (we don't intercept
 *      middle-click / ctrl-click / shift-click — power users get to
 *      bypass)
 *
 * "Don't show again" is scoped to the current battle id, so a new
 * battle gets a fresh warning.
 *
 * (UI copy keeps the "flashbang / sunglasses" voice — that's the
 * external brand. The component name and storage key are renamed for
 * a calmer internal vocabulary.)
 */
export function DarkModeWarning({ battle }: { battle: Battle | null }) {
  const { theme, ready } = useTheme();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [dontShow, setDontShow] = useState(false);
  const dismissedRef = useRef(false);

  // Refresh the dismissed-for-this-battle flag whenever the battle
  // changes, so a new battle re-arms the warning.
  useEffect(() => {
    if (!battle) {
      dismissedRef.current = false;
      return;
    }
    try {
      const key = `staybattle:darkmode-warned:${battle.id}`;
      dismissedRef.current = window.localStorage.getItem(key) === "1";
    } catch {
      dismissedRef.current = false;
    }
  }, [battle?.id]);

  useEffect(() => {
    if (!ready) return;
    if (theme !== "dark") return;
    if (!battle) return;

    const handler = (e: MouseEvent) => {
      if (dismissedRef.current) return;
      // Let power-users escape: ctrl/cmd/shift/middle/right-click bypass.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      // Only catch external Airbnb links — internal nav unaffected.
      if (!/^https?:\/\/(www\.)?airbnb\.[a-z.]+\//i.test(href)) return;
      e.preventDefault();
      setPendingUrl(href);
      setDontShow(false);
    };

    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [ready, theme, battle]);

  const proceed = useCallback(() => {
    if (!pendingUrl) return;
    if (dontShow && battle) {
      try {
        window.localStorage.setItem(
          `staybattle:darkmode-warned:${battle.id}`,
          "1",
        );
        dismissedRef.current = true;
      } catch {}
    }
    const url = pendingUrl;
    setPendingUrl(null);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [pendingUrl, dontShow, battle]);

  const cancel = useCallback(() => {
    setPendingUrl(null);
    setDontShow(false);
  }, []);

  // ESC to cancel, Enter to proceed — keyboard parity with the rest of
  // the app's dialogs.
  useEffect(() => {
    if (!pendingUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      else if (e.key === "Enter") proceed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingUrl, cancel, proceed]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!pendingUrl) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pendingUrl]);

  if (!pendingUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Heads up — Airbnb is bright"
      onClick={cancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sb-darkmode-glow flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 p-4 text-zinc-100 sm:gap-3.5 sm:p-5"
      >
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/limmy.jpg"
            alt=""
            width={80}
            height={80}
            aria-hidden="true"
            style={{ objectPosition: "70% 50%" }}
            className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-white/30 sm:h-20 sm:w-20"
          />
          <div className="min-w-0">
            <p className="sb-fight-label text-zinc-400">
              Incoming flashbang
            </p>
            <h3 className="text-lg font-bold leading-tight">
              Airbnb is bright.{" "}
              <span className="whitespace-nowrap">Brace yourself.</span>
            </h3>
          </div>
        </div>

        <p className="text-sm leading-snug text-zinc-300">
          You&apos;re in dark mode, but Airbnb doesn&apos;t have one. The
          page you&apos;re about to open is full white. Maybe put on some
          sunglasses.
        </p>

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-cyan-500"
          />
          Don&apos;t warn me again for this battle
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={cancel}
            className="rounded-sm border border-zinc-700 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:border-zinc-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={proceed}
            autoFocus
            className="rounded-sm border border-cyan-500/50 bg-cyan-500/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/25"
          >
            Take me to Airbnb ↗
          </button>
        </div>
      </div>
    </div>
  );
}
