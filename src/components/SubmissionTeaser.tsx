"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ListingWithStats } from "@/lib/types";

const PREFS_KEY = "staybattle:teaser:v2";
const SCROLL_PX_PER_SEC = 28;
const CYCLE_MS_MIN = 3200;
const CYCLE_MS_JITTER = 2400;

type Prefs = {
  scroll: boolean;
  cycle: boolean;
};

function loadPrefs(): Prefs {
  // Respect prefers-reduced-motion as the *default* — user toggles still win
  // and persist independently.
  let reduceMotion = false;
  if (typeof window !== "undefined" && window.matchMedia) {
    try {
      reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
  }
  const fallback: Prefs = { scroll: !reduceMotion, cycle: !reduceMotion };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      scroll: typeof parsed.scroll === "boolean" ? parsed.scroll : fallback.scroll,
      cycle: typeof parsed.cycle === "boolean" ? parsed.cycle : fallback.cycle,
    };
  } catch {
    return fallback;
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

/**
 * Animated "current submissions" teaser.
 *
 * - SCROLL on → single-row marquee that drifts left continuously.
 * - SCROLL off → static multi-row grid (the original behavior).
 * - CYCLE on  → each tile crossfades through up to 5 of its photos.
 * - CYCLE off → each tile shows just its first photo.
 *
 * Toggles are independent and persist in localStorage. Both default to ON
 * unless the user's OS has prefers-reduced-motion set.
 */
export function SubmissionTeaser({ listings }: { listings: ListingWithStats[] }) {
  const [prefs, setPrefs] = useState<Prefs>({ scroll: false, cycle: false });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
  }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const tiles = useMemo(() => {
    return listings
      .filter((l) => l.photos.length > 0)
      .map((l) => ({ id: l.id, photos: l.photos.slice(0, 5) }));
  }, [listings]);

  if (tiles.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-sm border border-dashed border-zinc-800 text-sm text-zinc-400">
        Nobody&apos;s submitted yet. Drop the first one below.
      </div>
    );
  }

  const showScroll = mounted && prefs.scroll;
  const showCycle = mounted && prefs.cycle;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 self-end">
        <button
          type="button"
          onClick={() => update({ scroll: !prefs.scroll })}
          aria-pressed={prefs.scroll}
          className={`rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
            prefs.scroll
              ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
              : "border-zinc-700 bg-zinc-950/60 text-zinc-400 hover:text-zinc-100"
          }`}
          title={prefs.scroll ? "Scrolling on — click for static grid" : "Static — click for scrolling banner"}
        >
          {prefs.scroll ? "▶ scrolling" : "▦ grid"}
        </button>
        <button
          type="button"
          onClick={() => update({ cycle: !prefs.cycle })}
          aria-pressed={prefs.cycle}
          className={`rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
            prefs.cycle
              ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
              : "border-zinc-700 bg-zinc-950/60 text-zinc-400 hover:text-zinc-100"
          }`}
          title={prefs.cycle ? "Photos rotating — click to freeze" : "Photos frozen — click to rotate"}
        >
          {prefs.cycle ? "🔄 cycling" : "🖼 frozen"}
        </button>
      </div>

      {showScroll ? (
        <ScrollStrip tiles={tiles} cycle={showCycle} />
      ) : (
        <StaticGrid tiles={tiles} cycle={showCycle} />
      )}
    </div>
  );
}

function StaticGrid({
  tiles,
  cycle,
}: {
  tiles: { id: string; photos: string[] }[];
  cycle: boolean;
}) {
  // The lg grid is 6-wide; pad with branded filler tiles so the last row is
  // never left ragged. 6 is also a multiple of 2 and 3, so xs/sm grids stay
  // aligned. The md=4 case can still have a single trailing slot — acceptable
  // trade-off for not over-padding small counts.
  const padding = (6 - (tiles.length % 6)) % 6;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {tiles.map((t) => (
        <Tile key={t.id} photos={t.photos} cycle={cycle} />
      ))}
      {Array.from({ length: padding }).map((_, i) => (
        <LogoTile key={`filler-${i}`} />
      ))}
    </div>
  );
}

function LogoTile() {
  // Using SVG with textLength + lengthAdjust forces "Stay" and "Battle" to
  // render at the exact same width even though they have different character
  // counts. CSS font-sizing can only approximate that.
  return (
    <div className="sb-deep-surface relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-sm border border-zinc-800/70 p-2">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(244,63,94,0.18),transparent_70%)]"
      />
      <svg
        viewBox="0 0 100 60"
        className="relative w-[88%] max-w-[180px]"
        role="img"
        aria-label="StayBattle"
      >
        <defs>
          <linearGradient id="sb-tile-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="35%" stopColor="#34d399" />
            <stop offset="70%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <text
          x="50"
          y="24"
          textAnchor="middle"
          textLength="92"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="var(--font-geist-sans), system-ui, sans-serif"
          fontWeight="900"
          fontSize="26"
          letterSpacing="-1"
          fill="url(#sb-tile-grad)"
        >
          Stay
        </text>
        <text
          x="50"
          y="52"
          textAnchor="middle"
          textLength="92"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="var(--font-geist-sans), system-ui, sans-serif"
          fontWeight="900"
          fontSize="26"
          letterSpacing="-1"
          fill="#fafafa"
        >
          Battle
        </text>
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        className="relative h-[20%] w-[20%] object-contain opacity-80 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]"
      />
    </div>
  );
}

function ScrollStrip({
  tiles,
  cycle,
}: {
  tiles: { id: string; photos: string[] }[];
  cycle: boolean;
}) {
  // Split tiles into two staggered rows that scroll in opposite directions.
  // Row 1 drifts left, row 2 drifts right at a slightly different speed. The
  // counter-motion makes the strip feel alive rather than ribbony.
  const [rowA, rowB] = useMemo(() => {
    const a: typeof tiles = [];
    const b: typeof tiles = [];
    tiles.forEach((t, i) => (i % 2 === 0 ? a : b).push(t));
    // If one row is empty (≤1 tile), duplicate the other so both rows show
    // motion rather than leaving a blank band.
    if (b.length === 0 && a.length > 0) b.push(...a);
    if (a.length === 0 && b.length > 0) a.push(...b);
    return [a, b];
  }, [tiles]);

  return (
    <div className="relative overflow-hidden rounded-sm">
      <div className="flex flex-col gap-2">
        <ScrollRow tiles={rowA} cycle={cycle} direction="left" speed={SCROLL_PX_PER_SEC} />
        <ScrollRow tiles={rowB} cycle={cycle} direction="right" speed={SCROLL_PX_PER_SEC * 0.78} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-zinc-950 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950 to-transparent"
      />
    </div>
  );
}

function ScrollRow({
  tiles,
  cycle,
  direction,
  speed,
}: {
  tiles: { id: string; photos: string[] }[];
  cycle: boolean;
  direction: "left" | "right";
  speed: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);

  // Duplicate to allow seamless wrap-around.
  const looped = useMemo(() => [...tiles, ...tiles], [tiles]);

  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();
    const sign = direction === "left" ? 1 : -1;
    // Start the rightward row partway through so the two rows feel offset.
    if (direction === "right") offsetRef.current = 80;
    const tick = (ts: number) => {
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const node = trackRef.current;
      if (node && !pausedRef.current) {
        offsetRef.current += speed * dt * sign;
        const halfWidth = node.scrollWidth / 2;
        if (halfWidth > 0) {
          if (offsetRef.current >= halfWidth) offsetRef.current -= halfWidth;
          else if (offsetRef.current < 0) offsetRef.current += halfWidth;
        }
        node.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [direction, speed]);

  return (
    <div
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <div
        ref={trackRef}
        className="flex gap-2 will-change-transform"
        style={{ width: "max-content" }}
      >
        {looped.map((t, i) => (
          <div
            key={`${t.id}-${i}`}
            className="w-24 shrink-0 sm:w-32 md:w-36"
          >
            <Tile photos={t.photos} cycle={cycle} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ photos, cycle }: { photos: string[]; cycle: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!cycle || photos.length <= 1) return;
    // Stagger each tile's interval so they don't flip in unison.
    const ms = CYCLE_MS_MIN + Math.floor(Math.random() * CYCLE_MS_JITTER);
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [cycle, photos.length]);

  // Render the previous photo as the background layer (stays at full opacity)
  // and the current photo on top with a fade-in animation triggered by the
  // React key change. Result: smooth crossfade with no hard cut.
  const prev = photos[(index - 1 + photos.length) % photos.length];
  const cur = photos[index];

  return (
    <div className="relative aspect-square overflow-hidden rounded-sm bg-zinc-900">
      {prev && prev !== cur && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={prev}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={cur}
        src={cur}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover sb-tile-fade-in"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/30 via-transparent to-transparent"
      />
    </div>
  );
}
