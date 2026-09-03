import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { signPayload, verifyPayload } from "./auth";

/**
 * Server-side voter identity cookie.
 *
 * Why this exists: the client's `useVoter()` reads localStorage, which the
 * server can't see. Before this cookie, the page was SSR'd with full
 * battle data regardless of who was visiting, and only a CLIENT-side
 * wrapper (`JoinGateWrapper`) hid it after hydration — meaning anyone
 * who `curl`'d the page got every voter name, invite code, comment, and
 * listing lat/lng in the response body.
 *
 * Fix: `signIn` writes the voter id+name into a cookie, `page.tsx` reads
 * it server-side, and only fetches the heavy data when the cookie's
 * voter is actually a participant of the current battle. The cookie is
 * also the authoritative authentication signal for every state-mutating
 * server action (see `requireSelf` / `requireOrganizer` / `requireMember`
 * in `src/app/actions.ts`).
 *
 * The cookie is httpOnly: client UI doesn't need it (identity for header
 * + voting controls lives in localStorage under `staybattle:auth:v2`,
 * mirrored at sign-in time). Keeping the auth-bearing cookie out of
 * `document.cookie` means XSS that steals page state can't lift the
 * session along with it.
 */

const COOKIE = "staybattle_voter";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export type CookieVoter = { id: string; name: string };

/**
 * Cookie attributes, split out so they can be unit-tested without a
 * request scope.
 *
 * `secure` is opt-in via STAYBATTLE_HTTPS=true rather than tied to
 * NODE_ENV: browsers drop Secure cookies on any plain-http origin except
 * localhost, so a production build served at http://192.168.x.x:3000 (the
 * documented `docker compose up` path) would "sign in" client-side while
 * every server action answered "Sign in first". Same flag that gates
 * HSTS / upgrade-insecure-requests in src/lib/security-headers.ts.
 */
export function voterCookieOptions(
  env: Record<string, string | undefined> = process.env,
) {
  return {
    maxAge: MAX_AGE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.STAYBATTLE_HTTPS === "true",
    path: "/",
  };
}

/**
 * Server-only HMAC secret for signing the voter cookie. Auto-generated once
 * and persisted in the settings table (i.e. the data dir), so it survives
 * restarts but never ships in the repo or image. If the row is ever lost,
 * a new secret is minted and all existing sessions are invalidated — the
 * safe failure direction.
 */
function authSecret(): string {
  const row = db
    .prepare("select value from settings where key = 'auth_secret'")
    .get() as { value: string } | undefined;
  if (row?.value) return row.value;
  const secret = randomBytes(32).toString("hex");
  db.prepare(
    "insert or replace into settings (key, value) values ('auth_secret', ?)",
  ).run(secret);
  return secret;
}

export async function setVoterCookie(voter: CookieVoter): Promise<void> {
  const jar = await cookies();
  const signed = signPayload(JSON.stringify(voter), authSecret());
  jar.set(COOKIE, signed, voterCookieOptions());
}

export async function clearVoterCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readVoterCookie(): Promise<CookieVoter | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  // Reject anything that isn't a valid HMAC-signed payload — this is what
  // stops a client from hand-editing the cookie to another voter's id.
  const verified = verifyPayload(raw, authSecret());
  if (!verified) return null;
  try {
    const parsed = JSON.parse(verified);
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
