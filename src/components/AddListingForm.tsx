"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addListing } from "@/app/actions";
import { useVoter } from "@/lib/voter";

const AIRBNB_URL = /https?:\/\/(?:[a-z0-9-]+\.)*airbnb\.[a-z.]+\/[^\s,;'"<>()\[\]]+/gi;

function extractAirbnbUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(AIRBNB_URL) ?? [];
  return Array.from(new Set(matches));
}

type Progress = {
  total: number;
  done: number;
  failures: { url: string; reason: string }[];
};

function ClipboardIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

export function AddListingForm() {
  const router = useRouter();
  const { voter } = useVoter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();

  const submitMany = useCallback(
    (urls: string[]) => {
      if (!voter || urls.length === 0) return;
      setError(null);
      setProgress({ total: urls.length, done: 0, failures: [] });
      startTransition(async () => {
        const failures: { url: string; reason: string }[] = [];
        let done = 0;
        for (const url of urls) {
          // eslint-disable-next-line no-await-in-loop
          const res = await addListing(url, voter.name, voter.id);
          done += 1;
          if (!res.ok) failures.push({ url, reason: res.error });
          setProgress({ total: urls.length, done, failures: [...failures] });
        }
        // Keep failed URLs in the box so the user can fix/retry; drop the
        // succeeded ones. If all failed, show the most-common error.
        const failedUrls = failures.map((f) => f.url);
        if (failures.length === 0) {
          setProgress(null);
          setInput("");
          setSuggestion(null);
        } else if (failures.length === urls.length) {
          setInput(failedUrls.join("\n"));
          // Single error if they're all the same, otherwise generic.
          const allSame = failures.every((f) => f.reason === failures[0].reason);
          setError(allSame ? failures[0].reason : `All ${urls.length} URLs failed — see details below.`);
          setProgress({ total: urls.length, done, failures });
        } else {
          // Partial: keep failures in the input + summary banner stays.
          setInput(failedUrls.join("\n"));
          setSuggestion(null);
        }
        router.refresh();
      });
    },
    [voter, router],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = extractAirbnbUrls(input);
    if (urls.length === 0) {
      setError(
        input.trim()
          ? "That doesn't look like an Airbnb URL — links must start with https://airbnb.com or a country variant."
          : "Paste an Airbnb URL first.",
      );
      return;
    }
    submitMany(urls);
  };

  const peekClipboard = useCallback(async (): Promise<string[]> => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return [];
    try {
      const text = await navigator.clipboard.readText();
      return extractAirbnbUrls(text);
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const onFocus = async () => {
      const hits = await peekClipboard();
      if (hits.length === 0) return;
      const fresh = hits.filter((h) => !dismissedRef.current.has(h));
      if (fresh.length === 0) return;
      if (input.trim()) return;
      setSuggestion(fresh);
    };
    onFocus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [peekClipboard, input]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      (expanded ? textareaRef.current : inputRef.current)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const explicitPaste = async () => {
    const hits = await peekClipboard();
    if (hits.length > 0) {
      setInput(hits.join("\n"));
      setSuggestion(null);
      if (hits.length > 1 && !expanded) setExpanded(true);
    } else {
      setError("No Airbnb URL in your clipboard.");
    }
  };

  const urlsInInput = extractAirbnbUrls(input);

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <label htmlFor={inputId} className="sr-only">
          Airbnb listing URL (or several, separated by spaces or new lines)
        </label>
        <div className="relative flex-1">
          {expanded ? (
            <textarea
              id={inputId}
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder={
                "Paste one Airbnb URL per line —\nhttps://www.airbnb.com/rooms/12345\nhttps://www.airbnb.com/rooms/67890\n…"
              }
              rows={5}
              className="w-full resize-y rounded-sm border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 pr-10 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-rose-400 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.18)]"
            />
          ) : (
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder="Paste an Airbnb URL…"
              className="w-full rounded-sm border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-rose-400 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.18)]"
            />
          )}
          <div
            className={`pointer-events-none absolute right-1 flex ${
              expanded ? "top-1 items-start" : "inset-y-0 items-center"
            }`}
          >
            <button
              type="button"
              onClick={explicitPaste}
              title="Paste from clipboard"
              aria-label="Paste from clipboard"
              className="pointer-events-auto rounded p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              <ClipboardIcon />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:w-44">
          <button
            type="submit"
            disabled={isPending || urlsInInput.length === 0}
            className="rounded-sm bg-gradient-to-r from-cyan-400 via-emerald-400 to-rose-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-zinc-950 shadow-[0_0_30px_-5px_rgba(244,63,94,0.55)] transition hover:brightness-110 disabled:opacity-40"
          >
            {isPending
              ? "Fetching…"
              : urlsInInput.length > 1
                ? `Add ${urlsInInput.length} contenders`
                : "Add contender"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-pressed={expanded}
            className="rounded-sm border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-200"
          >
            {expanded ? "Single URL" : "Paste multiple"}
          </button>
          <p className="text-[11px] leading-snug text-zinc-500">
            {expanded
              ? "One URL per line, or separate with spaces."
              : "Need to drop several URLs? Tap “Paste multiple” for a bigger box."}
          </p>
        </div>
      </form>

      {urlsInInput.length > 1 && !isPending && !progress && (
        <p className="text-xs text-cyan-300">
          {urlsInInput.length} Airbnb URLs detected — all will be added.
        </p>
      )}

      {progress && (
        <div
          role="status"
          aria-live="polite"
          className={`flex flex-col gap-1 rounded-sm border px-3 py-2 text-sm ${
            progress.failures.length === 0
              ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-200"
              : "border-rose-500/30 bg-rose-500/5 text-rose-100"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>
              {progress.done < progress.total
                ? `Adding ${progress.done} / ${progress.total}…`
                : `${progress.total - progress.failures.length} added`}
              {progress.failures.length > 0 && (
                <span className="ml-2 text-rose-300">
                  · {progress.failures.length} failed
                </span>
              )}
            </span>
            {progress.failures.length > 0 && progress.done >= progress.total && (
              <button
                type="button"
                onClick={() => setProgress(null)}
                className="font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:text-zinc-50"
              >
                dismiss
              </button>
            )}
          </div>
          {progress.failures.length > 0 && (
            <ul className="ml-3 list-disc text-xs text-rose-200">
              {progress.failures.map((f, i) => (
                <li key={`${f.url}-${i}`} className="break-all">
                  <span className="text-zinc-300">{f.url}</span> — {f.reason}
                </li>
              ))}
            </ul>
          )}
          {progress.failures.length > 0 && (
            <p className="mt-1 text-[11px] text-zinc-400">
              Failed URLs stayed in the box above. Fix them and submit again.
            </p>
          )}
        </div>
      )}

      {suggestion && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-2 rounded-sm border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-cyan-200">
              <span className="sb-fight-label text-cyan-300">clipboard</span>
              <span className="ml-2 text-zinc-300">
                {suggestion.length === 1
                  ? "1 Airbnb URL found"
                  : `${suggestion.length} Airbnb URLs found`}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const urls = suggestion;
                  setSuggestion(null);
                  submitMany(urls);
                }}
                className="rounded-sm border border-cyan-500/60 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/20"
              >
                {suggestion.length === 1 ? "Add it" : `Add all ${suggestion.length}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  suggestion.forEach((u) => dismissedRef.current.add(u));
                  setSuggestion(null);
                }}
                className="text-xs text-zinc-300 hover:text-zinc-50"
              >
                dismiss
              </button>
            </div>
          </div>
          {suggestion.length <= 3 && (
            <ul className="text-xs text-zinc-400">
              {suggestion.map((u) => (
                <li key={u} className="truncate">
                  {u}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
