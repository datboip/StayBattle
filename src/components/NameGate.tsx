"use client";

import { useId, useRef, useState, useTransition } from "react";
import { signIn } from "@/app/actions";
import { useVoter } from "@/lib/voter";

export function NameGate({ children }: { children: React.ReactNode }) {
  const { voter, ready, setVoter } = useVoter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [faqOpen, setFaqOpen] = useState(false);
  const nameId = useId();
  const pinId = useId();
  const faqContentRef = useRef<HTMLDivElement>(null);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!voter) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setWelcome(null);
      startTransition(async () => {
        const res = await signIn(name, pin);
        if (!res.ok) {
          setError(res.error);
        } else {
          setVoter({ id: res.id, name: res.name });
          if (res.created) setWelcome(`Welcome, ${res.name}.`);
        }
      });
    };

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm flex flex-col gap-4">
          <form
            onSubmit={submit}
            className="relative flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-7 shadow-[0_30px_80px_-30px_rgba(251,113,133,0.4)] backdrop-blur"
          >
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-banner.svg" alt="StayBattle" className="h-10 w-auto" />
              <p className="mt-3 text-xs text-zinc-400">
                Sign in to vote on the trip.
              </p>
            </div>

            <div className="rounded-sm border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs leading-relaxed text-zinc-300">
              <p>
                <strong className="text-cyan-200">Lucky you</strong> — someone
                in your crew is planning a vacation and you&apos;re helping
                pick the place. Everyone drops their favorite Airbnbs in the
                ring, you all vote, the best one wins.
              </p>
              <p className="mt-1 text-zinc-400">
                Sign in below to get started. Takes 10 seconds.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={nameId} className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  Your name
                </label>
                <input
                  id={nameId}
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="your name"
                  maxLength={40}
                  autoComplete="username"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                />
                <p className="text-[11px] text-zinc-500">
                  Shows up next to your votes and comments. Real name,
                  nickname, whatever — your crew just needs to know it&apos;s
                  you.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={pinId} className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  Your PIN (4–6 digits)
                </label>
                <input
                  id={pinId}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  minLength={4}
                  maxLength={6}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2.5 font-mono text-base tracking-[0.4em] text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                />
                <p className="text-[11px] text-zinc-500">
                  A secret number only you know. Keeps anyone else from voting
                  as you. Make up anything — birthday, lucky number, whatever
                  you&apos;ll remember.
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-rose-400">
                {error}
              </p>
            )}
            {welcome && (
              <p role="status" className="text-sm text-emerald-300">
                {welcome}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending || !name.trim() || pin.length < 4}
              className="rounded-lg bg-gradient-to-r from-emerald-400 via-cyan-500 to-rose-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-rose-500/20 transition hover:brightness-110 disabled:opacity-40"
            >
              {isPending ? "Checking…" : "Sign in"}
            </button>
          </form>

          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40">
            <button
              type="button"
              onClick={() => setFaqOpen((v) => !v)}
              aria-expanded={faqOpen}
              aria-controls="signin-faq"
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl px-5 py-3 text-xs font-medium text-zinc-300 hover:text-zinc-50"
            >
              <span>{faqOpen ? "Hide help" : "Need help? FAQ"}</span>
              <span
                aria-hidden="true"
                className={`font-mono text-[10px] uppercase tracking-wider text-zinc-500 transition-transform duration-300 ${
                  faqOpen ? "rotate-90" : ""
                }`}
              >
                ›
              </span>
            </button>
            {/* The grid-template-rows fr trick is the cleanest way to animate
                between height:0 and height:auto. The inner div has
                overflow:hidden so the content gets clipped during the
                transition instead of jumping. */}
            <div
              id="signin-faq"
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: faqOpen ? "1fr" : "0fr" }}
              aria-hidden={!faqOpen}
            >
              <div className="overflow-hidden">
                <div
                  ref={faqContentRef}
                  className="space-y-2 px-5 pb-5 text-[11px] leading-relaxed text-zinc-400"
                >
                  <p>
                    <strong className="text-zinc-200">First time here?</strong>{" "}
                    Type any name and any 4–6 digit PIN. They become yours
                    the moment you sign in.
                  </p>
                  <p>
                    <strong className="text-zinc-200">Coming back?</strong>{" "}
                    Use the same name and PIN you used before. Same combo
                    works on your phone, laptop, or any device — that&apos;s
                    the whole point of the PIN.
                  </p>
                  <p>
                    <strong className="text-zinc-200">Forgot your PIN?</strong>{" "}
                    No email resets (we don&apos;t have your email). Easiest
                    fix: pick a slightly different name and start fresh.
                  </p>
                  <p>
                    <strong className="text-zinc-200">What&apos;s next?</strong>{" "}
                    After you sign in you&apos;ll need an{" "}
                    <em className="text-zinc-300">invite code</em> from
                    whoever set up the battle. They&apos;ll send it as a
                    one-click link or a 6-character code.
                  </p>
                  <p>
                    <strong className="text-zinc-200">Is my info safe?</strong>{" "}
                    Your name, PIN, votes, and comments stay on the
                    organizer&apos;s computer — they&apos;re never sent to any
                    third party. No analytics, no trackers, no email
                    collection. The only outbound traffic is when someone
                    adds an Airbnb URL (the app fetches that listing&apos;s
                    page from Airbnb — nothing about you is sent) or pins a
                    place on the map (looked up on OpenStreetMap). Sign out
                    to clear your session on this device.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
