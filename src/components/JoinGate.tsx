"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinBattle } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { normalizeInviteCode, type Battle } from "@/lib/battle";

export function JoinGate({ battle }: { battle: Battle }) {
  const router = useRouter();
  const { voter } = useVoter();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  const autoSubmittedRef = useRef(false);

  // Read `?invite=` from the URL and pre-fill so an invite-link recipient
  // doesn't have to type anything. Also accepts a fallback in sessionStorage
  // for the case where someone clicked the link, did the NameGate flow, and
  // we want the code to survive across the sign-in step.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    let code = params.get("invite") ?? "";
    if (!code) {
      try {
        code = sessionStorage.getItem("staybattle:invite") ?? "";
      } catch {}
    } else {
      try {
        sessionStorage.setItem("staybattle:invite", code);
      } catch {}
    }
    if (code) setRaw(code);
  }, []);

  const code = normalizeInviteCode(raw);
  const tooShort = code.length < 4;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!voter) return;
    setError(null);
    startTransition(async () => {
      const res = await joinBattle(code, voter.id, voter.name);
      if (!res.ok) {
        setError(res.error);
      } else {
        // Clear the invite trace from the URL + sessionStorage so a refresh
        // doesn't re-trigger and the address bar doesn't leak the code.
        try {
          sessionStorage.removeItem("staybattle:invite");
        } catch {}
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.has("invite")) {
            url.searchParams.delete("invite");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }
        router.refresh();
      }
    });
  };

  // Auto-submit if a valid-length code was pre-filled from the URL — saves
  // the recipient one extra tap. Must live ABOVE the `if (!voter)` early
  // return so the hook count stays stable across renders (Rules of Hooks).
  useEffect(() => {
    if (!voter) return;
    if (autoSubmittedRef.current) return;
    if (isPending || error) return;
    if (raw && !tooShort) {
      autoSubmittedRef.current = true;
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, tooShort, isPending, error, voter]);

  if (!voter) return null;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5 py-8">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={36} height={36} />
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tight text-zinc-100">
            Got an invite code?
          </h2>
          <p className="text-xs text-zinc-400">
            <span className="text-zinc-100">{battle.name}</span>
            {" "}is happening, but you&apos;re not on the list yet. Ask{" "}
            <span className="text-zinc-100">{battle.organizer_name}</span>
            {" "}for the code or invite link.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor={inputId}
            className="font-mono text-[10px] uppercase tracking-wider text-zinc-400"
          >
            Invite code
          </label>
          <input
            id={inputId}
            autoFocus
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setError(null);
              autoSubmittedRef.current = true; // prevent auto-submit after manual edit
            }}
            placeholder="ABC123"
            maxLength={32}
            autoComplete="off"
            className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-3 text-center font-mono text-2xl uppercase tracking-[0.4em] text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-rose-400"
          />
          <p className="text-[11px] text-zinc-500">
            6 letters/numbers, case-insensitive.
            <br className="hidden sm:inline" />{" "}
            If you clicked an invite link, this is already filled in.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || tooShort}
          className="rounded-sm bg-gradient-to-r from-emerald-400 via-cyan-500 to-rose-500 px-5 py-3 text-sm font-bold uppercase tracking-wider text-zinc-950 shadow-[0_0_30px_-5px_rgba(244,63,94,0.55)] disabled:opacity-40"
        >
          {isPending ? "Joining…" : "Join the battle"}
        </button>
      </form>

      <p className="text-center text-[11px] text-zinc-500">
        Signed in as <span className="text-zinc-300">{voter.name}</span>. If
        that&apos;s wrong, sign out from the header above.
      </p>
    </section>
  );
}
