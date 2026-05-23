"use client";

import { useVoter } from "@/lib/voter";
import type { Battle, Participant } from "@/lib/battle";
import { JoinGate } from "./JoinGate";

/**
 * Decides whether to show the JoinGate or the real battle UI based on whether
 * the current signed-in voter is a participant of this battle. Lives on the
 * client because it needs the voter from localStorage; everything inside is
 * just children passed through unchanged.
 */
export function JoinGateWrapper({
  battle,
  participants,
  children,
}: {
  battle: Battle;
  participants: Participant[];
  children: React.ReactNode;
}) {
  const { voter } = useVoter();
  if (!voter) return null; // NameGate handles the not-signed-in case
  const isMember = participants.some((p) => p.voter_id === voter.id);
  if (!isMember) return <JoinGate battle={battle} />;
  return <>{children}</>;
}
