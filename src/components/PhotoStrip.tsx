"use client";

import { useState } from "react";

export function PhotoStrip({
  photos,
  title,
  onPhotoClick,
}: {
  photos: string[];
  title: string | null;
  onPhotoClick?: (index: number) => void;
}) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-sm bg-zinc-900 text-sm text-zinc-400">
        No photo
      </div>
    );
  }

  const next = () => setIndex((i) => (i + 1) % photos.length);
  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-zinc-900">
      <button
        type="button"
        onClick={() => onPhotoClick?.(index)}
        className="block h-full w-full"
        aria-label={`${title || "Listing"} photo ${index + 1} of ${photos.length}${onPhotoClick ? " — open fullscreen" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[index]}
          alt={`${title || "Listing"} photo ${index + 1}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-sm text-white shadow hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-sm text-white shadow hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500"
            aria-label="Next photo"
          >
            ›
          </button>
          <div
            aria-live="polite"
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white"
          >
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
