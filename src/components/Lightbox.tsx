"use client";

import { useCallback, useEffect, useState } from "react";

export function Lightbox({
  photos,
  startIndex,
  alt,
  onClose,
}: {
  photos: string[];
  startIndex: number;
  alt: string | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);

  const next = useCallback(() => setIndex((i) => (i + 1) % photos.length), [photos.length]);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + photos.length) % photos.length),
    [photos.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, next, prev]);

  // Lock body scroll while the lightbox is open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index]}
        alt={`${alt || "Listing"} — photo ${index + 1} of ${photos.length}`}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/80 text-xl text-white hover:bg-zinc-800"
        aria-label="Close photo viewer"
      >
        ×
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-900/80 text-2xl text-white hover:bg-zinc-800"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-900/80 text-2xl text-white hover:bg-zinc-800"
            aria-label="Next photo"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900/80 px-3 py-1 text-sm text-white">
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
