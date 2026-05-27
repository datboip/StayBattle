import "server-only";
import { cookies } from "next/headers";

/**
 * Server-side voter identity cookie.
 *
 * Why this exists: the client's `useVoter()` reads localStorage, which the
 * server can't see. Before this cookie, the page was SSR'd with full
 * battle data regardless of who was visiting, and only a CLIENT-side
 * wrapper (`JoinGateWrapper`) hid it after hydration — meaning anyone
 * who `curl`'d the page got every voter name, invite code, comment, and
 * listing lat/lng in the response body. The audit (2026-05-27) flagged
 * this as the single biggest leak.
 *
 * Fix: `signIn` writes the voter id+name into a cookie, `page.tsx` reads
 * it server-side, and only fetches the heavy data when the cookie's
 * voter is actually a participant of the current battle.
 *
 * The cookie is NOT httpOnly because the client UI still reads voter
 * info for in-browser state (header, voting controls). That's the same
 * exposure surface as the existing localStorage approach. The server
 * doesn't trust the cookie value beyond using it as a key into the
 * voters/participants tables — anyone who tampers with it ends up at a
 * voter id that doesn't exist or isn't in the battle and gets gated out
 * the same as an anonymous visitor.
 */

const COOKIE = "staybattle_voter";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export type CookieVoter = { id: string; name: string };

export async function setVoterCookie(voter: CookieVoter): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(voter), {
    maxAge: MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Intentionally NOT httpOnly: the client UI still consults this
    // identity. See the file comment above.
  });
}

export async function clearVoterCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readVoterCookie(): Promise<CookieVoter | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.name === "string"
    ) {
      return parsed as CookieVoter;
    }
  } catch {
    // Malformed cookie — treat as signed out. Don't leak the parse error.
  }
  return null;
}
