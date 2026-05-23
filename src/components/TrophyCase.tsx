"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePastBattle } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { confirmDialog } from "./Modal";
import type { PastBattle, PodiumEntry } from "@/lib/types";

const MEDAL: Record<1 | 2 | 3, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const MEDAL_LABEL: Record<1 | 2 | 3, string> = {
  1: "Gold",
  2: "Silver",
  3: "Bronze",
};

/**
 * Read-only history of finished battles. Hides exact trip dates by design —
 * shows just month/year, the medal tiers, and summary counts. Comments and
 * individual votes are gone from this view.
 */
export function TrophyCase({ past }: { past: PastBattle[] }) {
  if (past.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="sb-fight-label text-zinc-200">
        🏆 Trophy case · {past.length} past {past.length === 1 ? "battle" : "battles"}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {past.map((b) => (
          <PastBattleCard key={b.id} past={b} />
        ))}
      </div>
    </section>
  );
}

function formatSeason(checkIn: string | null, checkOut: string | null): string {
  // Show season only (month-year), not exact dates — keeps the trip private.
  if (!checkIn) return "—";
  try {
    const a = new Date(`${checkIn}T00:00:00`);
    const b = checkOut ? new Date(`${checkOut}T00:00:00`) : a;
    const fmt = (d: Date) =>
      d.toLocaleString(undefined, { month: "short", year: "numeric" });
    const aFmt = fmt(a);
    const bFmt = fmt(b);
    if (aFmt === bFmt) return aFmt;
    if (a.getFullYear() === b.getFullYear()) {
      return `${a.toLocaleString(undefined, { month: "short" })} – ${b.toLocaleString(
        undefined,
        { month: "short" },
      )} ${a.getFullYear()}`;
    }
    return `${aFmt} – ${bFmt}`;
  } catch {
    return "—";
  }
}

function groupByTier(podium: PodiumEntry[]): Map<1 | 2 | 3, PodiumEntry[]> {
  const out = new Map<1 | 2 | 3, PodiumEntry[]>();
  for (const e of podium) {
    // Default tier 3 for legacy rows that predate the tier field.
    const t = (e.tier ?? 3) as 1 | 2 | 3;
    const arr = out.get(t) ?? [];
    arr.push(e);
    out.set(t, arr);
  }
  return out;
}

function PastBattleCard({ past }: { past: PastBattle }) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isPending, startTransition] = useTransition();

  const tiers = useMemo(() => groupByTier(past.podium), [past.podium]);
  const goldTier = tiers.get(1) ?? [];
  const heroImage = goldTier[0]?.image_url ?? null;

  const remove = async () => {
    if (!voter) return;
    const ok = await confirmDialog({
      title: `Delete "${past.name}"?`,
      body: "Removes the summary from the trophy case. Airbnb listings themselves aren't touched. Can't undo.",
      confirm: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      await deletePastBattle(voter.id, past.id);
      router.refresh();
    });
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60">
      <div className="flex items-start gap-3 p-3">
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt={goldTier[0]?.short_title || goldTier[0]?.title || "winner"}
            className="h-24 w-24 shrink-0 rounded-sm object-cover"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="truncate font-bold uppercase tracking-tight text-zinc-100">
              {past.name}
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              {formatSeason(past.check_in, past.check_out)}
            </span>
          </div>

          {past.podium.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">No votes cast</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {([1, 2, 3] as const).map((t) => {
                const entries = tiers.get(t) ?? [];
                if (entries.length === 0) return null;
                const tied = entries.length > 1;
                return (
                  <li key={t} className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      {MEDAL[t]} {MEDAL_LABEL[t]}
                      {tied && (
                        <span className="ml-1.5 rounded-sm bg-amber-500/15 px-1 text-[9px] text-amber-200">
                          {entries.length}-WAY TIE
                        </span>
                      )}
                      <span className="ml-2 font-mono tabular-nums text-zinc-500">
                        ({entries[0].score > 0 ? `+${entries[0].score}` : entries[0].score})
                      </span>
                    </span>
                    <ul className="flex flex-col gap-0.5 pl-5 text-sm">
                      {entries.map((e, i) => (
                        <li key={`${e.url}-${i}`} className="truncate">
                          {e.url ? (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-100 hover:underline"
                              title={e.title || e.url}
                            >
                              {e.short_title || e.title || "Untitled"}
                            </a>
                          ) : (
                            <span className="text-zinc-100">
                              {e.short_title || e.title || "Untitled"}
                            </span>
                          )}
                          {e.location && (
                            <span className="ml-1 text-zinc-500">
                              · {e.location.split(",")[0]}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            {past.participant_names.length}{" "}
            {past.participant_names.length === 1 ? "person" : "people"}
            <span className="mx-1.5">·</span>
            {past.total_listings} listings
            <span className="mx-1.5">·</span>
            {past.total_votes} votes
            {past.organizer_name && (
              <>
                <span className="mx-1.5">·</span>
                organized by {past.organizer_name}
              </>
            )}
          </p>
        </div>

        {voter && (
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            aria-label={`Remove ${past.name} from the trophy case`}
            className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-zinc-500 hover:text-rose-300"
          >
            ×
          </button>
        )}
      </div>
    </article>
  );
}
