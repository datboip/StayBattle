import { fetchAllListings, fetchAllPlaces } from "@/lib/data";
import { getTripDates } from "@/lib/trip-server";
import {
  getCurrentBattle,
  listParticipants,
  isParticipant,
} from "@/lib/battle-server";
import { toPublicBattle } from "@/lib/battle";
import { listPastBattles } from "@/lib/past-battles-server";
import { readVoterCookie } from "@/lib/auth-cookie";
import { getBattleRequirements } from "@/lib/requirements-server";
import { RequirementsPanel } from "@/components/RequirementsPanel";
import { NameGate } from "@/components/NameGate";
import { HeaderBar } from "@/components/HeaderBar";
import { AddListingForm } from "@/components/AddListingForm";
import { ListingGrid } from "@/components/ListingGrid";
import { MapSection } from "@/components/MapSection";
import { BattleSetup } from "@/components/BattleSetup";
import { BattleHeader } from "@/components/BattleHeader";
import { FlashbangBanner } from "@/components/FlashbangBanner";
import { SubmissionPhase } from "@/components/SubmissionPhase";
import { InviteCodePanel } from "@/components/InviteCodePanel";
import { AvailabilityPanel } from "@/components/AvailabilityPanel";
import { JoinGate } from "@/components/JoinGate";
import { TrophyCase } from "@/components/TrophyCase";
import { DemoModal } from "@/components/DemoModal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const demoMode = process.env.STAYBATTLE_DEMO_MODE === "true";
  const battle = getCurrentBattle();

  // Server-side gate: only members of the current battle see listings /
  // participants / comments. Anonymous visitors (no cookie) and visitors
  // signed in as someone outside the battle get a stripped page that
  // exposes only the battle name + JoinGate prompt + past-battles
  // social proof.
  //
  // PRIVACY: this is the closure for HIGH#1 from the audit
  // (2026-05-27) — the previous JoinGateWrapper was CLIENT-only, so
  // `curl /` returned the entire battle payload (invite code, lat/lng,
  // every comment body) regardless of who was visiting.
  const cookieVoter = await readVoterCookie();
  const isMember = !!(
    battle && cookieVoter && isParticipant(battle.id, cookieVoter.id)
  );

  const listings = isMember ? fetchAllListings() : [];
  const places = isMember ? fetchAllPlaces() : [];
  const participants =
    isMember && battle ? listParticipants(battle.id) : [];
  const requirements = isMember ? getBattleRequirements() : [];
  const tripDates = battle
    ? { checkIn: battle.check_in, checkOut: battle.check_out }
    : getTripDates();
  // past_battles already stores only month-rounded dates + no exact
  // lat/lng in podium JSON (see past-battles-server.ts:archiveCurrentBattle).
  // Treated as social-proof content, so we render it pre-gate.
  const pastBattles = listPastBattles();

  // Strip `invite_code` and `organizer_id` from anything we render
  // pre-gate. Anonymous SSR'd HTML should never contain the invite
  // code (sharable secret) or the organizer's UUID (impersonation
  // primer). Members get the full battle object since they need
  // invite_code for the InviteCodePanel and organizer_id for the
  // organizer-only controls.
  const publicBattle = battle ? toPublicBattle(battle) : null;
  const headerBattle = isMember ? battle : publicBattle;

  return (
    <NameGate>
      <DemoModal enabled={demoMode} />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <HeaderBar battle={headerBattle} />

        {!battle ? (
          <>
            <BattleSetup />
            <TrophyCase past={pastBattles} />
          </>
        ) : !isMember ? (
          <>
            <JoinGate battle={publicBattle!} />
            <TrophyCase past={pastBattles} />
          </>
        ) : (
          <>
            <BattleHeader battle={battle} />
            <FlashbangBanner battle={battle} />
            <InviteCodePanel battle={battle} participants={participants} />
            {battle.phase === "submission" ? (
              <>
                <AddListingForm />
                <SubmissionPhase listings={listings} tripDates={tripDates} />
              </>
            ) : (
              <>
                <AvailabilityPanel listings={listings} battle={battle} />
                <RequirementsPanel
                  battle={battle}
                  initialRequirements={requirements}
                />
                <ListingGrid
                  listings={listings}
                  tripDates={tripDates}
                  battle={battle}
                  places={places}
                  requirements={requirements}
                />
                <MapSection
                  listings={listings}
                  places={places}
                  tripDates={tripDates}
                />
              </>
            )}
            <TrophyCase past={pastBattles} />
          </>
        )}

        <footer className="mt-auto flex flex-col items-center gap-2 pt-8 text-center text-xs text-zinc-400">
          <p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-banner.svg" alt="StayBattle" className="inline-block h-4 w-auto align-middle" />
            {" "}· settle the vacation argument
          </p>
          <div className="mx-auto max-w-2xl rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-amber-300/80">
              Heads up · double-check everything
            </p>
            <p>
              The availability badges are a best-effort guess scraped from
              Airbnb&apos;s public page — they&apos;re wrong about 10–15%
              of the time because real booking eligibility (minimum stay,
              host approval, just-booked, calendar sync lag, total price)
              is decided client-side after the page loads. <strong>Before
              you commit to a place, click through to Airbnb and confirm
              the dates, price, and reserve button yourself.</strong>{" "}
              StayBattle helps you argue, not book.
            </p>
          </div>
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Unaffiliated with any listing service shown. · Self-hosted, provided AS IS{" "}
            with NO WARRANTY of any kind, express or implied. Use at your
            own risk. Have fun. · Open source under{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-zinc-700 hover:text-zinc-200 hover:decoration-rose-400"
            >
              AGPL v3
            </a>
            {" · "}
            {/* AGPL §13: network users get to see the source */}
            <a
              href="https://github.com/datboip/StayBattle"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-zinc-700 hover:text-zinc-200 hover:decoration-cyan-400"
            >
              Source code
            </a>
          </p>
        </footer>
      </main>
    </NameGate>
  );
}
