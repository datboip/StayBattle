"use client";

import { useEffect, useState } from "react";
import { VERSION, GIT_SHA_SHORT } from "@/lib/version";

const STORAGE_KEY = "staybattle:demo-modal-dismissed:v1";

const DEMO_VOTERS = [
  { name: "Alex", pin: "1111", role: "Organizer" },
  { name: "Sam", pin: "2222", role: "Voter" },
  { name: "Jordan", pin: "3333", role: "Voter" },
  { name: "Riley", pin: "4444", role: "Voter" },
  { name: "Casey", pin: "5555", role: "Voter" },
  { name: "Morgan", pin: "6666", role: "Voter" },
  { name: "Drew", pin: "7777", role: "Voter" },
  { name: "Quinn", pin: "8888", role: "Voter" },
];

export function DemoModal({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    setOpen(true);
  }, [enabled]);

  function dismiss() {
    if (dontShow) {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
  }

  if (!enabled || !open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="border-b border-zinc-800 bg-gradient-to-br from-rose-500/10 via-zinc-950 to-cyan-500/10 px-6 py-5">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-400">
            Demo mode
          </p>
          <h2
            id="demo-modal-title"
            className="text-2xl font-bold tracking-tight text-zinc-100"
          >
            Welcome to the StayBattle demo
          </h2>
        </div>

        <div className="space-y-4 px-6 py-5 text-sm leading-relaxed text-zinc-300">
          <p>
            This is a <strong>public demo</strong>. Anyone can play with it.
            <br />
            <span className="text-zinc-400">
              No warranties, no guarantees, no real data should live here.
            </span>
          </p>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] leading-relaxed text-amber-200/90">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-amber-300/80">
              Resets nightly · 04:00 UTC
            </p>
            <p>
              Everything you do here gets wiped every 24 hours. Don&apos;t
              put anything you care about in this instance — self-host for
              that.
            </p>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Invite code
            </p>
            <code className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-sm text-cyan-300">
              DEMO99
            </code>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Demo accounts (name · PIN · role)
            </p>
            <div className="overflow-hidden rounded-md border border-zinc-800">
              <table className="w-full font-mono text-[12px]">
                <tbody>
                  {DEMO_VOTERS.map((v, i) => (
                    <tr
                      key={v.name}
                      className={
                        i % 2 === 0 ? "bg-zinc-900/50" : "bg-zinc-950"
                      }
                    >
                      <td className="px-3 py-1.5 text-zinc-200">{v.name}</td>
                      <td className="px-3 py-1.5 text-cyan-300">{v.pin}</td>
                      <td className="px-3 py-1.5 text-zinc-500">
                        {v.role === "Organizer" ? (
                          <span className="text-rose-300">{v.role}</span>
                        ) : (
                          v.role
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Sign in as <span className="text-rose-300">Alex / 1111</span>{" "}
              to try the organizer powers (close battle, kick voters, edit
              dates). Anyone else is a regular voter.
            </p>
          </div>
        </div>

        <div className="px-6 pb-3 pt-1 text-[10px] font-mono text-zinc-600">
          Demo running v{VERSION} · {GIT_SHA_SHORT}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/60 px-6 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-zinc-400">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 text-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            Don&apos;t show again
          </label>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md bg-gradient-to-br from-rose-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
