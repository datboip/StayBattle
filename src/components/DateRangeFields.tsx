"use client";

import { useId, useRef } from "react";
import { resolveCheckOut } from "@/lib/dates";

/**
 * Check-in + check-out native date inputs that behave like a range: picking
 * check-in auto-fills check-out to the next day (if empty or now invalid) and
 * pops its picker open, so the crew sets a trip in one gesture instead of
 * fighting two disconnected fields. Renders two labelled field <div>s; the
 * parent supplies the surrounding layout (grid, inline bar, …).
 */
export function DateRangeFields({
  checkIn,
  checkOut,
  onCheckIn,
  onCheckOut,
  compact = false,
}: {
  checkIn: string;
  checkOut: string;
  onCheckIn: (v: string) => void;
  onCheckOut: (v: string) => void;
  compact?: boolean;
}) {
  const ciId = useId();
  const coId = useId();
  const coRef = useRef<HTMLInputElement>(null);

  const pad = compact ? "px-2 py-1" : "px-3 py-2";
  const inputClass = `rounded-sm border border-zinc-700 bg-zinc-900/60 ${pad} text-sm text-zinc-100 outline-none focus:border-rose-400`;
  const labelClass =
    "font-mono text-[10px] uppercase tracking-wider text-zinc-400";

  const handleCheckIn = (value: string) => {
    onCheckIn(value);
    const resolved = resolveCheckOut(value, checkOut);
    if (resolved !== checkOut) onCheckOut(resolved);
    if (!value) return;
    // Nudge the crew straight to picking the end date. showPicker() is the
    // supported way to open a native date UI; not all browsers allow it, so
    // fall back to focus. requestAnimationFrame lets the value settle first.
    requestAnimationFrame(() => {
      const el = coRef.current;
      if (!el) return;
      try {
        el.showPicker();
      } catch {
        el.focus();
      }
    });
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={ciId} className={labelClass}>
          Check-in
        </label>
        <input
          id={ciId}
          type="date"
          value={checkIn}
          onChange={(e) => handleCheckIn(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={coId} className={labelClass}>
          Check-out
        </label>
        <input
          id={coId}
          ref={coRef}
          type="date"
          value={checkOut}
          min={checkIn || undefined}
          onChange={(e) => onCheckOut(e.target.value)}
          className={inputClass}
        />
      </div>
    </>
  );
}
