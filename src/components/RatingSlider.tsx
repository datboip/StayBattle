"use client";

import { useEffect, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import type { VoteValue } from "@/lib/types";

const COMPACT_LABELS = ["1", "2", "3", "4", "5"];
const LARGE_LABELS = ["Nope", "Meh", "OK", "Like", "Love"];

type Size = "compact" | "large";

/**
 * 1-5 rating slider built on Radix. Brand rose-to-teal gradient track, 5
 * tick dots at thumb-stop positions, labels under each tick.
 *
 * Default-value bias fix: Radix `onValueCommit` only fires on release
 * (pointer up / keyboard blur), not while dragging. Plus we track
 * `interacted` to dim the thumb and show "drag to rate" until the user
 * actually commits a vote.
 *
 * iOS bonus: Radix handles tap-on-track-jumps-thumb. Native range input
 * doesn't on iOS — main reason we use this over plain <input type=range>.
 */
export function RatingSlider({
  value,
  onCommit,
  size = "compact",
  disabled = false,
}: {
  value: VoteValue | null;
  onCommit: (v: VoteValue) => void;
  size?: Size;
  disabled?: boolean;
}) {
  const isLarge = size === "large";
  const labels = isLarge ? LARGE_LABELS : COMPACT_LABELS;

  const [draft, setDraft] = useState<VoteValue>(value ?? 3);
  const [interacted, setInteracted] = useState(value !== null);

  useEffect(() => {
    if (value !== null) {
      setDraft(value);
      setInteracted(true);
    }
  }, [value]);

  const wrapClass = [
    "rating",
    isLarge ? "rating-large" : "",
    interacted ? "" : "rating-uncommitted",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapClass}>
      <Slider.Root
        min={1}
        max={5}
        step={1}
        value={[draft]}
        disabled={disabled}
        onValueChange={(v) => {
          const next = v[0] as VoteValue;
          setDraft(next);
          if (!interacted) setInteracted(true);
        }}
        onValueCommit={(v) => onCommit(v[0] as VoteValue)}
        className="rating-root"
        aria-label="Rate 1 to 5"
      >
        <Slider.Track className="rating-track">
          <Slider.Range className="rating-range" />
          {labels.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="rating-tick"
              style={{ left: `${(i / 4) * 100}%` }}
            />
          ))}
        </Slider.Track>
        <Slider.Thumb className="rating-thumb" />
      </Slider.Root>
      <div className="rating-ticks" aria-hidden="true">
        {labels.map((label, i) => (
          <span
            key={i}
            className={`rating-tick-label ${draft === i + 1 && interacted ? "rating-tick-label-active" : ""}`}
            style={{ left: `${(i / 4) * 100}%` }}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="rating-hint">
        {interacted ? `${draft} / 5` : "Drag to rate"}
      </p>
    </div>
  );
}
