import "server-only";
import { db, newId } from "./db";
import type { Battle, BattlePhase, Participant } from "./battle";
import { deadlinePassed, generateInviteCode } from "./battle";

const SETTINGS_KEY = "battle";

type Row = Battle;

function readRow(): Row | null {
  const row = db
    .prepare("select value from settings where key = ?")
    .get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as Row;
    if (!parsed || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRow(b: Battle) {
  db.prepare(
    `insert into settings (key, value, updated_at) values (?, ?, datetime('now'))
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SETTINGS_KEY, JSON.stringify(b));
}

/**
 * Returns the current battle. If the persisted phase is "submission" but the
 * deadline has already passed, auto-flips it to "voting" and persists the
 * change — so any caller sees the correct phase without extra logic.
 */
export function getCurrentBattle(): Battle | null {
  const battle = readRow();
  if (!battle) return null;
  if (battle.phase === "submission" && deadlinePassed(battle)) {
    const flipped: Battle = {
      ...battle,
      phase: "voting",
      started_at: battle.started_at ?? new Date().toISOString(),
    };
    writeRow(flipped);
    return flipped;
  }
  return battle;
}

export function createBattle(input: {
  name: string;
  organizer_id: string;
  organizer_name: string;
  check_in: string | null;
  check_out: string | null;
  submission_deadline: string;
}): Battle {
  const battle: Battle = {
    id: newId(),
    name: input.name,
    organizer_id: input.organizer_id,
    organizer_name: input.organizer_name,
    check_in: input.check_in,
    check_out: input.check_out,
    submission_deadline: input.submission_deadline,
    phase: "submission",
    invite_code: generateInviteCode(),
    created_at: new Date().toISOString(),
    started_at: null,
  };
  writeRow(battle);
  // Organizer is implicitly a participant.
  addParticipant(battle.id, input.organizer_id, input.organizer_name);
  return battle;
}

export function regenerateInviteCode(): Battle | null {
  const cur = readRow();
  if (!cur) return null;
  const next: Battle = { ...cur, invite_code: generateInviteCode() };
  writeRow(next);
  return next;
}

export function addParticipant(
  battleId: string,
  voterId: string,
  voterName: string,
): void {
  db.prepare(
    `insert into participants (battle_id, voter_id, voter_name)
     values (?, ?, ?)
     on conflict (battle_id, voter_id) do update set voter_name = excluded.voter_name`,
  ).run(battleId, voterId, voterName);
}

/**
 * Remove a participant from the battle. By default their votes + comments
 * are preserved — kicking should be reversible. Pass `removeVotes: true`
 * if the organizer explicitly chose to wipe their ratings (the UI asks).
 *
 * Comments are never auto-deleted here — removing them would silently
 * change a thread that other people participated in. Comment moderation
 * stays a separate, comment-by-comment flow.
 */
export function removeParticipant(
  battleId: string,
  voterId: string,
  removeVotes = false,
): void {
  // Atomic: either the participant row goes and the votes go, or neither.
  const tx = db.transaction(() => {
    if (removeVotes) {
      db.prepare("delete from votes where voter_id = ?").run(voterId);
    }
    db.prepare(
      "delete from participants where battle_id = ? and voter_id = ?",
    ).run(battleId, voterId);
  });
  tx();
}

/** How many votes a single voter currently has across the whole DB. Used
 *  by the kick confirmation flow to decide whether to ask about removal. */
export function countVotesByVoter(voterId: string): number {
  const row = db
    .prepare("select count(*) as n from votes where voter_id = ?")
    .get(voterId) as { n: number } | undefined;
  return row?.n ?? 0;
}

export function isParticipant(battleId: string, voterId: string): boolean {
  const row = db
    .prepare(
      "select 1 from participants where battle_id = ? and voter_id = ? limit 1",
    )
    .get(battleId, voterId);
  return Boolean(row);
}

export function listParticipants(battleId: string): Participant[] {
  return db
    .prepare(
      "select battle_id, voter_id, voter_name, joined_at from participants where battle_id = ? order by joined_at asc",
    )
    .all(battleId) as Participant[];
}

export function updateBattlePhase(phase: BattlePhase): Battle | null {
  const cur = readRow();
  if (!cur) return null;
  const next: Battle = {
    ...cur,
    phase,
    started_at:
      phase === "voting" && !cur.started_at ? new Date().toISOString() : cur.started_at,
  };
  writeRow(next);
  return next;
}

export function patchBattle(patch: Partial<Battle>): Battle | null {
  const cur = readRow();
  if (!cur) return null;
  const next: Battle = { ...cur, ...patch };
  writeRow(next);
  return next;
}

export function deleteBattle(): void {
  db.prepare("delete from settings where key = ?").run(SETTINGS_KEY);
}
