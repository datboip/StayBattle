"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateInviteCode, kickParticipant } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { confirmDialog } from "./Modal";
import type { Battle, Participant } from "@/lib/battle";

function InfoCard({
  heading,
  body,
  tone,
}: {
  heading: string;
  body: string;
  tone: "cyan" | "rose" | "zinc";
}) {
  const toneClasses: Record<typeof tone, string> = {
    cyan: "border-cyan-500/30 text-cyan-200",
    rose: "border-rose-500/30 text-rose-200",
    zinc: "border-zinc-700 text-zinc-200",
  };
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-zinc-800 bg-zinc-900/40 p-3">
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.18em] ${toneClasses[tone]}`}
      >
        {heading}
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-300">{body}</p>
    </div>
  );
}

/**
 * Organizer-only panel: shows the current invite code with a copy button,
 * regenerate button, and the participant list with kick controls.
 */
export function InviteCodePanel({
  battle,
  participants,
}: {
  battle: Battle;
  participants: Participant[];
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [feedback, setFeedback] = useState<"copied" | "select" | null>(null);
  const [linkFeedback, setLinkFeedback] = useState<"copied" | "select" | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const codeRef = useRef<HTMLSpanElement>(null);
  const hiddenLinkRef = useRef<HTMLTextAreaElement>(null);

  if (!voter || voter.id !== battle.organizer_id) return null;

  // The invite link uses the current browser's URL as the host so a self-hosted
  // instance gets its own working link (LAN IP, tailscale name, ngrok URL,
  // public domain — whatever the organizer is currently on).
  const buildInviteLink = (): string => {
    if (typeof window === "undefined") return `?invite=${battle.invite_code}`;
    const u = new URL(window.location.href);
    u.pathname = "/";
    u.hash = "";
    u.search = `?invite=${battle.invite_code}`;
    return u.toString();
  };

  // Generic copy helper: Clipboard API → execCommand → fall back to visible
  // selection so the user can ⌘C/Ctrl+C themselves.
  const copyText = async (
    text: string,
    fallbackSelect: () => boolean,
  ): Promise<"copied" | "select"> => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return "copied";
      } catch {}
    }
    const ok = fallbackSelect();
    return ok ? "copied" : "select";
  };

  const copy = async () => {
    const result = await copyText(battle.invite_code, () => {
      const node = codeRef.current;
      if (!node) return false;
      const range = document.createRange();
      range.selectNodeContents(node);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      }
    });
    setFeedback(result);
    setTimeout(() => setFeedback(null), 2000);
  };

  const copyLink = async () => {
    const link = buildInviteLink();
    const result = await copyText(link, () => {
      // Use a hidden textarea for execCommand("copy") of the link — the link
      // itself isn't rendered on the page, so we need a temporary host node.
      const ta = hiddenLinkRef.current;
      if (!ta) return false;
      ta.value = link;
      ta.select();
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      }
    });
    setLinkFeedback(result);
    setTimeout(() => setLinkFeedback(null), 2000);
  };

  const selectAll = () => {
    const node = codeRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const regen = async () => {
    const ok = await confirmDialog({
      title: "Generate a new invite code?",
      body: "The current code stops working immediately. Anyone who hasn't joined yet will need the new one.",
      confirm: "New code",
    });
    if (!ok) return;
    startTransition(async () => {
      await regenerateInviteCode(voter.id);
      router.refresh();
    });
  };

  const kick = async (vid: string, vname: string) => {
    const ok = await confirmDialog({
      title: `Kick ${vname}?`,
      body: "They lose access to the battle right away. They can rejoin with the invite code if you don't regenerate it.",
      confirm: "Kick",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      await kickParticipant(voter.id, vid);
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="sb-fight-label text-zinc-200">Invite the crew</h3>
        <span className="rounded-sm border border-amber-500/40 bg-amber-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
          organizer only
        </span>
      </header>

      <textarea
        ref={hiddenLinkRef}
        aria-hidden="true"
        tabIndex={-1}
        readOnly
        className="sr-only"
      />

      {/* Big code dashboard — the focal point */}
      <div className="sb-deep-surface relative overflow-hidden rounded-sm border border-zinc-800">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(6,182,212,0.18),transparent_70%),radial-gradient(circle_at_50%_120%,rgba(244,63,94,0.18),transparent_70%)]"
        />
        <div className="relative flex flex-col items-center gap-2 px-6 py-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400">
            Invite code
          </p>
          <span
            ref={codeRef}
            onClick={selectAll}
            className="cursor-text select-all font-mono text-4xl font-black tracking-[0.35em] text-zinc-50 drop-shadow-[0_0_18px_rgba(244,63,94,0.35)] sm:text-5xl"
            role="textbox"
            aria-readonly="true"
            tabIndex={0}
            title="Tap to select"
          >
            {battle.invite_code}
          </span>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            tap to select · 6 chars, case-insensitive
          </p>
        </div>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy invite link"
          className="rounded-sm border border-cyan-500/50 bg-cyan-500/10 px-3 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/20"
        >
          {linkFeedback === "copied"
            ? "link copied"
            : linkFeedback === "select"
              ? "selected — ⌘C"
              : "copy link"}
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy invite code"
          className="rounded-sm border border-zinc-700 bg-zinc-900/70 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider text-zinc-200 hover:border-rose-500/60 hover:text-rose-200"
        >
          {feedback === "copied"
            ? "code copied"
            : feedback === "select"
              ? "selected — ⌘C"
              : "copy code"}
        </button>
        <button
          type="button"
          onClick={regen}
          disabled={isPending}
          className="rounded-sm border border-zinc-700 bg-zinc-900/70 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider text-zinc-300 hover:border-rose-500/60 hover:text-rose-300 disabled:opacity-40"
        >
          new code
        </button>
      </div>

      {/* Help section — info cards, not a wall of text */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-zinc-800" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            How invites work
          </span>
          <span className="h-px flex-1 bg-zinc-800" />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <InfoCard
            heading="The link"
            tone="cyan"
            body="The easy path. Text, Slack, or email it. When they open it, the code is filled in automatically — they just sign in."
          />
          <InfoCard
            heading="Their sign-in"
            tone="rose"
            body="Each person picks a name + makes up a 4–6 digit PIN. The PIN locks their identity so nobody else can vote as them."
          />
          <InfoCard
            heading="Rolling the code"
            tone="zinc"
            body="“New code” disables the current code/link. People already in the battle stay in — use Kick to remove someone."
          />
        </div>
      </div>

      {/* Participants list */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-zinc-800" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Crew · {participants.length}{" "}
            {participants.length === 1 ? "person" : "people"}
          </span>
          <span className="h-px flex-1 bg-zinc-800" />
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {participants.map((p) => (
            <li
              key={p.voter_id}
              className="inline-flex items-center gap-1.5 rounded-sm border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  p.voter_id === battle.organizer_id
                    ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]"
                    : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                }`}
              />
              <span className="text-zinc-100">{p.voter_name}</span>
              {p.voter_id === battle.organizer_id ? (
                <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300">
                  organizer
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => kick(p.voter_id, p.voter_name)}
                  disabled={isPending}
                  className="rounded-sm px-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500 hover:bg-rose-500/15 hover:text-rose-300"
                  aria-label={`Kick ${p.voter_name}`}
                >
                  kick
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
