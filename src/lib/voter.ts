"use client";

import { useEffect, useState } from "react";
import { signOut as signOutAction } from "@/app/actions";

const AUTH_KEY = "staybattle:auth:v2";
// Legacy keys from before name+PIN sign-in landed.
const LEGACY_ID = "quickie:voter_id";
const LEGACY_NAME = "quickie:voter_name";

export type Voter = { id: string; name: string };

function readAuth(): Voter | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.name === "string"
    ) {
      return parsed as Voter;
    }
  } catch {}
  return null;
}

function writeAuth(v: Voter | null) {
  if (v) localStorage.setItem(AUTH_KEY, JSON.stringify(v));
  else localStorage.removeItem(AUTH_KEY);
}

export function useVoter(): {
  voter: Voter | null;
  ready: boolean;
  setVoter: (v: Voter | null) => void;
  signOut: () => void;
} {
  const [voter, setVoterState] = useState<Voter | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Clear any legacy v1 identity so the user is forced through the new
    // PIN-based sign-in flow on first load after upgrade.
    if (localStorage.getItem(LEGACY_ID) || localStorage.getItem(LEGACY_NAME)) {
      localStorage.removeItem(LEGACY_ID);
      localStorage.removeItem(LEGACY_NAME);
    }
    setVoterState(readAuth());
    setReady(true);

    // Keep tabs in sync — if you sign out in one tab, others follow.
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_KEY) setVoterState(readAuth());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setVoter = (v: Voter | null) => {
    writeAuth(v);
    setVoterState(v);
  };

  const signOut = () => {
    setVoter(null);
    // Fire-and-forget the server cookie clear; UI doesn't wait. Worst
    // case (network blip) the cookie stays a tiny bit but the next page
    // load's gate logic still rejects since localStorage is cleared
    // and the gate trusts isParticipant on the server anyway.
    void signOutAction();
  };

  return { voter, ready, setVoter, signOut };
}
