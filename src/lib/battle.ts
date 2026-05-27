// Client-safe battle types & helpers. No DB imports here — server work
// lives in battle-server.ts.

export type BattlePhase = "submission" | "voting" | "closed";

export type Battle = {
  id: string;
  name: string;
  organizer_id: string;
  organizer_name: string;
  check_in: string | null;
  check_out: string | null;
  submission_deadline: string; // ISO timestamp
  phase: BattlePhase;
  invite_code: string;
  created_at: string;
  started_at: string | null;
};

/**
 * Public-safe subset of a Battle — strips `invite_code` (a sharable
 * secret) and `organizer_id` (a UUID enumerable across pages). Used
 * for the pre-join render path where anonymous visitors should see
 * the battle name + organizer's display name but nothing useful for
 * impersonation or invite-code recovery.
 */
export type PublicBattle = Omit<Battle, "invite_code" | "organizer_id">;

export function toPublicBattle(b: Battle): PublicBattle {
  // Explicit destructure rather than rest-spread so the shape is
  // obvious at the call site and tsc surfaces accidental field
  // additions to Battle.
  return {
    id: b.id,
    name: b.name,
    organizer_name: b.organizer_name,
    check_in: b.check_in,
    check_out: b.check_out,
    submission_deadline: b.submission_deadline,
    phase: b.phase,
    created_at: b.created_at,
    started_at: b.started_at,
  };
}

export type Participant = {
  battle_id: string;
  voter_id: string;
  voter_name: string;
  joined_at: string;
};

// Friendly alphabet: no 0/O, 1/I/L confusion. Easy to read over text.
const INVITE_ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ23456789";

export function generateInviteCode(length: number = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return out;
}

export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function deadlinePassed(battle: Battle, now: number = Date.now()): boolean {
  const d = new Date(battle.submission_deadline).getTime();
  return Number.isFinite(d) && d <= now;
}

/**
 * What phase should the battle actually be in right now, given the wall clock?
 * If we wrote "submission" to the DB but the deadline has passed, the caller
 * should auto-flip to "voting" before rendering.
 */
export function effectivePhase(battle: Battle, now: number = Date.now()): BattlePhase {
  if (battle.phase !== "submission") return battle.phase;
  return deadlinePassed(battle, now) ? "voting" : "submission";
}

export function formatDeadlineCountdown(
  battle: Battle,
  now: number = Date.now(),
): string {
  const remaining = new Date(battle.submission_deadline).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "deadline passed";
  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 2) return `${days} days left`;
  if (days === 1) return `1 day, ${hours - 24}h left`;
  if (hours >= 2) return `${hours}h ${minutes % 60}m left`;
  if (hours === 1) return `1h ${minutes % 60}m left`;
  if (minutes > 1) return `${minutes} min left`;
  return "less than a minute left";
}
