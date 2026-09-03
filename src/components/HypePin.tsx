/**
 * The submitter's one-line "hype" rendered as a pushpin sticky note on the
 * listing photo — their opening argument, right where everyone looks. Purely
 * an overlay: pointer-events are off so it never blocks the photo's own
 * click-to-zoom.
 */
export function HypePin({ text }: { text: string }) {
  return (
    <div
      className="pointer-events-none absolute left-2.5 top-2.5 z-20 max-w-[82%] -rotate-3"
      title={text}
    >
      {/* pin head */}
      <span
        aria-hidden="true"
        className="absolute -top-1.5 left-3 h-2.5 w-2.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff9d8a,#f43f5e)] shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
      />
      <div className="line-clamp-2 rounded-[3px] bg-gradient-to-b from-amber-200 to-amber-300 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase leading-tight tracking-wide text-amber-950 shadow-lg shadow-black/40">
        {text}
      </div>
    </div>
  );
}
