"use server";

import { revalidatePath } from "next/cache";
import { db, newId } from "@/lib/db";
import { scrapeAirbnb, normalizeUrl, extractAirbnbId } from "@/lib/scrape";
import { geocode, viewboxFromPoints } from "@/lib/geocode";
import { consume, LIMITS } from "@/lib/rate-limit";
import { hashPin, verifyPin, isValidPin, normalizeName } from "@/lib/auth";
import { isValidIsoDate } from "@/lib/trip";
import { setTripDates as writeTripDates, getTripDates } from "@/lib/trip-server";
import {
  queueAllListings,
  queueOne,
  clearAllAvailability,
} from "@/lib/availability-queue";
import {
  createBattle as writeCreateBattle,
  updateBattlePhase,
  patchBattle,
  getCurrentBattle,
  deleteBattle,
  addParticipant,
  removeParticipant,
  isParticipant,
  regenerateInviteCode as writeRegenerateInviteCode,
} from "@/lib/battle-server";
import { normalizeInviteCode, type Battle } from "@/lib/battle";
import {
  archiveCurrentBattle,
  deletePastBattle as removePastBattle,
} from "@/lib/past-battles-server";
import {
  cleanString,
  validateAirbnbUrl,
  NAME_MAX,
  COMMENT_MAX,
  PLACE_QUERY_MAX,
  URL_MAX,
  VOTER_ID_MAX,
} from "@/lib/validate";
import { isKnownPlaceCategoryId } from "@/lib/place-categories";
import { haversineKm } from "@/lib/distance";
import { normalizePlaceName, mergeContributor } from "@/lib/place-dedup";
import {
  setVoterCookie,
  clearVoterCookie,
} from "@/lib/auth-cookie";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SignInResult =
  | { ok: true; id: string; name: string; created: boolean }
  | { ok: false; error: string };

/**
 * Sign in or register. If the name doesn't exist, create a new voter with the
 * given PIN. If it does, verify the PIN matches. Returns the canonical voter
 * id + display name on success.
 */
export async function signIn(
  rawName: string,
  rawPin: string,
): Promise<SignInResult> {
  const name = cleanString(rawName, NAME_MAX);
  const pin = cleanString(rawPin, 6);
  if (!name) return { ok: false, error: "Pick a name" };
  if (!isValidPin(pin)) return { ok: false, error: "PIN must be 4–6 digits" };

  // Rate-limit by name to slow brute-force enumeration.
  if (!consume(`signin:${normalizeName(name)}`, LIMITS.signIn)) {
    return { ok: false, error: "Too many attempts. Wait a moment and try again." };
  }

  const nameKey = normalizeName(name);
  const existing = db
    .prepare("select id, name, pin_hash from voters where name_key = ?")
    .get(nameKey) as
    | { id: string; name: string; pin_hash: string }
    | undefined;

  if (existing) {
    if (!verifyPin(pin, existing.pin_hash)) {
      return { ok: false, error: "Wrong PIN for that name." };
    }
    // Mirror the voter id into a same-site cookie so the server can gate
    // SSR access. The cookie is the source of truth on the server; the
    // client localStorage handles UI-side state.
    await setVoterCookie({ id: existing.id, name: existing.name });
    return { ok: true, id: existing.id, name: existing.name, created: false };
  }

  const id = newId();
  db.prepare(
    `insert into voters (id, name, name_key, pin_hash) values (?, ?, ?, ?)`,
  ).run(id, name, nameKey, hashPin(pin));
  await setVoterCookie({ id, name });
  return { ok: true, id, name, created: true };
}

/**
 * Clear the server-side voter cookie. Called by the client `signOut`
 * flow alongside its localStorage cleanup so the server-side gate also
 * forgets who you are.
 */
export async function signOut(): Promise<ActionResult> {
  await clearVoterCookie();
  revalidatePath("/");
  return { ok: true };
}

const RATE_LIMITED: ActionResult = {
  ok: false,
  error: "Slow down — you're hitting the rate limit. Try again in a minute.",
};

export async function addListing(
  urlInput: string,
  addedByName: string,
  addedById: string = "",
): Promise<ActionResult> {
  const name = cleanString(addedByName, NAME_MAX);
  const voterId = cleanString(addedById, VOTER_ID_MAX);
  const rawUrl = cleanString(urlInput, URL_MAX);
  if (!rawUrl) return { ok: false, error: "URL is required" };

  // During the voting/closed phase, no new submissions are allowed.
  const battle = getCurrentBattle();
  if (battle && battle.phase !== "submission") {
    return { ok: false, error: "Submissions closed — the battle has started." };
  }
  // Must be a participant of the active battle.
  if (battle && voterId && !isParticipant(battle.id, voterId)) {
    return { ok: false, error: "You're not in this battle." };
  }

  if (!consume(`add:${name || "anon"}`, LIMITS.addListing)) return RATE_LIMITED;

  const canonical = validateAirbnbUrl(rawUrl) ?? validateAirbnbUrl(normalizeUrl(rawUrl));
  if (!canonical || !extractAirbnbId(canonical)) {
    return { ok: false, error: "Only Airbnb /rooms/<id> URLs are supported" };
  }

  const existing = db
    .prepare("select id from listings where url = ?")
    .get(canonical);
  if (existing) {
    revalidatePath("/");
    return { ok: true };
  }

  let scraped;
  try {
    scraped = await scrapeAirbnb(canonical);
  } catch (e) {
    return { ok: false, error: `Could not fetch listing: ${(e as Error).message}` };
  }

  const newListingId = newId();
  db.prepare(
    `insert into listings (
      id, url, airbnb_id, title, image_url, photos,
      price_per_night, currency, location, latitude, longitude,
      bedrooms, bathrooms, beds, max_guests,
      rating, review_count, added_by_name, added_by_id
    ) values (
      @id, @url, @airbnb_id, @title, @image_url, @photos,
      @price_per_night, @currency, @location, @latitude, @longitude,
      @bedrooms, @bathrooms, @beds, @max_guests,
      @rating, @review_count, @added_by_name, @added_by_id
    )`,
  ).run({
    id: newListingId,
    url: canonical,
    airbnb_id: scraped.airbnb_id,
    title: scraped.title,
    image_url: scraped.image_url,
    photos: JSON.stringify(scraped.photos),
    price_per_night: scraped.price_per_night,
    currency: scraped.currency,
    location: scraped.location,
    latitude: scraped.latitude,
    longitude: scraped.longitude,
    bedrooms: scraped.bedrooms,
    bathrooms: scraped.bathrooms,
    beds: scraped.beds,
    max_guests: scraped.max_guests,
    rating: scraped.rating,
    review_count: scraped.review_count,
    added_by_name: name || null,
    added_by_id: voterId || null,
  });

  // If trip dates are set, check availability for the new listing.
  const dates = getTripDates();
  if (dates.checkIn && dates.checkOut) {
    queueOne(newListingId, canonical, dates.checkIn, dates.checkOut);
  }

  revalidatePath("/");
  return { ok: true };
}

/**
 * Cast a 1–5 star rating on a listing. Passing `value = 0` deletes the
 * voter's existing rating (used by the UI when a voter "unselects" their
 * choice). Re-rating overwrites the previous value.
 */
export async function castVote(
  listingId: string,
  voterId: string,
  voterName: string,
  value: 0 | 1 | 2 | 3 | 4 | 5,
): Promise<ActionResult> {
  const id = cleanString(listingId, 64);
  const vid = cleanString(voterId, VOTER_ID_MAX);
  if (!id || !vid) return { ok: false, error: "Missing id" };
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    return { ok: false, error: "Invalid vote" };
  }
  if (!consume(`vote:${vid}`, LIMITS.vote)) return RATE_LIMITED;

  // Block self-vote — submitters shouldn't be able to rate their own
  // listing. The 1–5 scale already moderates ballot-stuffing but a
  // submitter giving themselves 5 and everyone else 1 is the obvious
  // failure mode the rating slider can't dampen on its own.
  const ownerRow = db
    .prepare("select added_by_id from listings where id = ?")
    .get(id) as { added_by_id: string | null } | undefined;
  if (ownerRow && ownerRow.added_by_id && ownerRow.added_by_id === vid) {
    return { ok: false, error: "Can't rate your own listing" };
  }

  const name = cleanString(voterName, NAME_MAX) || "anon";

  if (value === 0) {
    db.prepare(
      "delete from votes where listing_id = ? and voter_id = ?",
    ).run(id, vid);
  } else {
    db.prepare(
      `insert into votes (listing_id, voter_id, voter_name, value)
       values (?, ?, ?, ?)
       on conflict (listing_id, voter_id) do update set
         value = excluded.value,
         voter_name = excluded.voter_name`,
    ).run(id, vid, name, value);
  }

  revalidatePath("/");
  return { ok: true };
}

export async function addComment(
  listingId: string,
  voterId: string,
  voterName: string,
  body: string,
  parentId: string = "",
): Promise<ActionResult> {
  const id = cleanString(listingId, 64);
  const vid = cleanString(voterId, VOTER_ID_MAX);
  const pid = cleanString(parentId, 64);
  const text = cleanString(body, COMMENT_MAX);
  if (!id || !vid) return { ok: false, error: "Missing id" };
  if (!text) return { ok: false, error: "Empty comment" };
  if (!consume(`comment:${vid}`, LIMITS.comment)) return RATE_LIMITED;

  const name = cleanString(voterName, NAME_MAX) || "anon";

  // If a parent is given, sanity check that it belongs to the same listing
  // and isn't itself a reply (keep nesting flat at one level).
  let parentValue: string | null = null;
  if (pid) {
    const parent = db
      .prepare(
        "select listing_id, parent_id from comments where id = ?",
      )
      .get(pid) as { listing_id: string; parent_id: string | null } | undefined;
    if (!parent || parent.listing_id !== id) {
      return { ok: false, error: "Reply parent not found" };
    }
    // Flatten: if you reply to a reply, anchor on the top-level comment.
    parentValue = parent.parent_id ?? pid;
  }

  db.prepare(
    `insert into comments (id, listing_id, voter_id, voter_name, body, parent_id)
     values (?, ?, ?, ?, ?, ?)`,
  ).run(newId(), id, vid, name, text, parentValue);

  revalidatePath("/");
  return { ok: true };
}

export async function deleteComment(
  commentId: string,
  voterId: string,
): Promise<ActionResult> {
  const id = cleanString(commentId, 64);
  const vid = cleanString(voterId, VOTER_ID_MAX);
  if (!id || !vid) return { ok: false, error: "Missing id" };

  // You can delete your own comments. Organizer can delete anyone's.
  const row = db
    .prepare("select voter_id, listing_id from comments where id = ?")
    .get(id) as { voter_id: string; listing_id: string } | undefined;
  if (!row) return { ok: true }; // already gone

  const battle = getCurrentBattle();
  const isOrganizer = !!battle && battle.organizer_id === vid;
  if (row.voter_id !== vid && !isOrganizer) {
    return { ok: false, error: "Not yours to delete" };
  }

  // Replies to this comment get nuked too so the thread doesn't dangle.
  db.prepare("delete from comments where id = ? or parent_id = ?").run(id, id);
  revalidatePath("/");
  return { ok: true };
}

export async function removeListing(
  listingId: string,
  voterId: string = "",
): Promise<ActionResult> {
  const id = cleanString(listingId, 64);
  const vid = cleanString(voterId, VOTER_ID_MAX);
  if (!id) return { ok: false, error: "Missing id" };
  if (!consume(`remove:${id}`, LIMITS.remove)) return RATE_LIMITED;

  // During submission, you can only remove your own submissions.
  // During voting/closed, the organizer (or anyone) can eliminate.
  const battle = getCurrentBattle();
  const row = db
    .prepare("select added_by_id from listings where id = ?")
    .get(id) as { added_by_id: string | null } | undefined;

  if (battle && battle.phase === "submission") {
    if (!row) return { ok: false, error: "Listing not found" };
    if (!vid || row.added_by_id !== vid) {
      return { ok: false, error: "You can only remove your own submissions during submission phase." };
    }
  }

  db.prepare("delete from listings where id = ?").run(id);
  revalidatePath("/");
  return { ok: true };
}

export async function addPlace(
  query: string,
  addedByName: string,
): Promise<ActionResult> {
  const q = cleanString(query, PLACE_QUERY_MAX);
  if (!q) return { ok: false, error: "Type a place to find" };
  const name = cleanString(addedByName, NAME_MAX);

  if (!consume(`place:${name || "anon"}`, LIMITS.place)) return RATE_LIMITED;

  let url: string | null = null;
  let searchTerm = q;
  let directCoords: { lat: number; lng: number } | null = null;

  try {
    const u = new URL(q);
    if (u.protocol === "http:" || u.protocol === "https:") {
      url = u.toString();
      const host = u.hostname.replace(/^www\./, "");

      const addrParam =
        u.searchParams.get("address") ||
        u.searchParams.get("q") ||
        u.searchParams.get("query");
      const llParam = u.searchParams.get("ll") || u.searchParams.get("center");

      if (llParam) {
        const m = llParam.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
        if (m) directCoords = { lat: Number(m[1]), lng: Number(m[2]) };
      }
      if (addrParam) {
        const m = addrParam.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
        if (m) directCoords = { lat: Number(m[1]), lng: Number(m[2]) };
        else searchTerm = cleanString(addrParam, PLACE_QUERY_MAX);
      } else if (!llParam) {
        searchTerm = host.split(".")[0];
      }
    }
  } catch {}

  if (directCoords) {
    if (
      !Number.isFinite(directCoords.lat) ||
      !Number.isFinite(directCoords.lng) ||
      Math.abs(directCoords.lat) > 90 ||
      Math.abs(directCoords.lng) > 180
    ) {
      return { ok: false, error: "Invalid coordinates in URL" };
    }
    if (placeAlreadyExists({ url, lat: directCoords.lat, lng: directCoords.lng })) {
      revalidatePath("/");
      return { ok: true };
    }
    db.prepare(
      `insert into places (id, name, url, latitude, longitude, kind, added_by_name)
       values (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId(),
      searchTerm.trim().slice(0, 120) || "Pinned location",
      url,
      directCoords.lat,
      directCoords.lng,
      "reference",
      name || null,
    );
    revalidatePath("/");
    return { ok: true };
  }

  const points = db
    .prepare("select latitude, longitude from listings where latitude is not null")
    .all() as { latitude: number; longitude: number }[];
  const viewbox = viewboxFromPoints(points);

  let hit;
  try {
    hit = await geocode(searchTerm, viewbox);
  } catch (e) {
    return { ok: false, error: `Geocode failed: ${(e as Error).message}` };
  }
  if (!hit) return { ok: false, error: `Couldn't find "${q}" on the map` };

  if (placeAlreadyExists({ url, lat: hit.latitude, lng: hit.longitude })) {
    revalidatePath("/");
    return { ok: true };
  }

  db.prepare(
    `insert into places (id, name, url, latitude, longitude, kind, added_by_name)
     values (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    cleanString(hit.name, 120) || "Pinned location",
    url,
    hit.latitude,
    hit.longitude,
    "reference",
    name || null,
  );

  revalidatePath("/");
  return { ok: true };
}

/**
 * Add a place at known coordinates — skips geocoding entirely. Used by the
 * map's "drop a pin" mode where the user clicks the map and we already have
 * lat/lng. addPlace() above handles the search-by-name path.
 */
export async function addPlaceAtCoords(
  name: string,
  address: string | null,
  url: string | null,
  lat: number,
  lng: number,
  addedByName: string,
  kind: string = "other",
): Promise<ActionResult> {
  const cleanName = cleanString(name, 120);
  if (!cleanName) return { ok: false, error: "Place needs a name" };
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return { ok: false, error: "Invalid coordinates" };
  }

  const addedBy = cleanString(addedByName, NAME_MAX);
  if (!consume(`place:${addedBy || "anon"}`, LIMITS.place)) return RATE_LIMITED;

  // Same URL validation as addPlace — only accept real http(s) URLs.
  let cleanUrl: string | null = null;
  if (url) {
    try {
      const u = new URL(url.trim());
      if (u.protocol === "http:" || u.protocol === "https:") {
        cleanUrl = u.toString();
      }
    } catch {
      // Reject malformed URLs silently — name + coords still get saved.
    }
  }
  // Free-text address — capped at 240 chars, no validation. Stored as-is.
  const cleanAddress = address ? cleanString(address, 240) || null : null;

  // Whitelist `kind` — anything not in the curated set falls back to "other"
  // so a client posting a junk value can't poison the row.
  const cleanKind = isKnownPlaceCategoryId(kind) ? kind : "other";

  // Light dedup: if a place with this same name already exists within
  // ~50m, merge the new submitter into its `added_by_name` list instead
  // of inserting a duplicate row. Surfaces "added by Alice, Bob" so the
  // crew sees consensus building. Different-name pins at the same spot
  // (a strip mall, etc.) are still allowed — name match is required.
  const merged = mergeSameNameNearby({
    name: cleanName,
    lat,
    lng,
    addedBy: addedBy || "",
  });
  if (merged) {
    revalidatePath("/");
    return { ok: true };
  }

  if (placeAlreadyExists({ url: cleanUrl, lat, lng })) {
    revalidatePath("/");
    return { ok: true };
  }

  db.prepare(
    `insert into places (id, name, address, url, latitude, longitude, kind, added_by_name)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    cleanName,
    cleanAddress,
    cleanUrl,
    lat,
    lng,
    cleanKind,
    addedBy || null,
  );

  revalidatePath("/");
  return { ok: true };
}

/**
 * If a place with the normalized form of `name` already sits within
 * ~50m of (lat, lng), merge `addedBy` into its contributor list and
 * return true. Returns false when no match — caller proceeds with the
 * normal insert.
 */
function mergeSameNameNearby({
  name,
  lat,
  lng,
  addedBy,
}: {
  name: string;
  lat: number;
  lng: number;
  addedBy: string;
}): boolean {
  const normalized = normalizePlaceName(name);
  if (!normalized) return false;
  // Bounding-box pre-filter: ~110m latitude buffer (0.001°) so the
  // haversine check below has a small candidate set to walk. lng buffer
  // scales with cos(lat) so high latitudes don't run a too-wide query.
  const latBuf = 0.001;
  const lngBuf = 0.001 / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const candidates = db
    .prepare(
      `select id, name, latitude, longitude, added_by_name from places
       where latitude between ? and ?
         and longitude between ? and ?`,
    )
    .all(lat - latBuf, lat + latBuf, lng - lngBuf, lng + lngBuf) as Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    added_by_name: string | null;
  }>;
  for (const c of candidates) {
    if (normalizePlaceName(c.name) !== normalized) continue;
    const km = haversineKm({ lat, lng }, { lat: c.latitude, lng: c.longitude });
    if (km > 0.05) continue; // tighter than the pre-filter — ~50m hard cap
    const next = mergeContributor(c.added_by_name, addedBy);
    if (next !== null) {
      db.prepare("update places set added_by_name = ? where id = ?").run(
        next,
        c.id,
      );
    }
    return true;
  }
  return false;
}

export async function removePlace(placeId: string): Promise<ActionResult> {
  const id = cleanString(placeId, 64);
  if (!id) return { ok: false, error: "Missing id" };
  if (!consume(`remove-place:${id}`, LIMITS.remove)) return RATE_LIMITED;
  db.prepare("delete from places where id = ?").run(id);
  revalidatePath("/");
  return { ok: true };
}

export async function setTripDates(
  checkIn: string,
  checkOut: string,
): Promise<ActionResult> {
  const ci = cleanString(checkIn, 10);
  const co = cleanString(checkOut, 10);
  if (ci && !isValidIsoDate(ci)) return { ok: false, error: "Bad check-in date" };
  if (co && !isValidIsoDate(co)) return { ok: false, error: "Bad check-out date" };
  if (ci && co && new Date(ci) >= new Date(co)) {
    return { ok: false, error: "Check-out must be after check-in" };
  }
  writeTripDates({ checkIn: ci || null, checkOut: co || null });

  if (ci && co) {
    // Kick off availability checks in the background. Returns immediately —
    // the queue processes serially with a delay, and each listing updates its
    // row as it completes. The page polls every 6s so badges show up live.
    queueAllListings(ci, co);
  } else {
    clearAllAvailability();
  }

  revalidatePath("/");
  return { ok: true };
}

export async function overrideAvailability(
  listingId: string,
  organizerId: string,
  reason: string,
  status: "available" | "unavailable" = "available",
): Promise<ActionResult> {
  const id = cleanString(listingId, 64);
  const oid = cleanString(organizerId, VOTER_ID_MAX);
  const why = cleanString(reason, 500);
  if (!id) return { ok: false, error: "Missing id" };
  if (!why) return { ok: false, error: "Add a reason so the crew knows why" };
  if (status !== "available" && status !== "unavailable") {
    return { ok: false, error: "Bad override status" };
  }

  const battle = getCurrentBattle();
  if (!battle) return { ok: false, error: "No active battle" };
  if (oid !== battle.organizer_id) {
    return { ok: false, error: "Only the organizer can override availability" };
  }

  const row = db
    .prepare("select id from listings where id = ?")
    .get(id);
  if (!row) return { ok: false, error: "Listing not found" };

  db.prepare(
    `update listings
        set availability_override = ?,
            availability_override_by = ?,
            availability_override_at = datetime('now'),
            availability_override_status = ?
      where id = ?`,
  ).run(why, battle.organizer_name, status, id);
  revalidatePath("/");
  return { ok: true };
}

export async function clearAvailabilityOverride(
  listingId: string,
  organizerId: string,
): Promise<ActionResult> {
  const id = cleanString(listingId, 64);
  const oid = cleanString(organizerId, VOTER_ID_MAX);
  if (!id) return { ok: false, error: "Missing id" };

  const battle = getCurrentBattle();
  if (!battle) return { ok: false, error: "No active battle" };
  if (oid !== battle.organizer_id) {
    return { ok: false, error: "Only the organizer can clear an override" };
  }

  db.prepare(
    `update listings
        set availability_override = null,
            availability_override_by = null,
            availability_override_at = null,
            availability_override_status = null
      where id = ?`,
  ).run(id);
  revalidatePath("/");
  return { ok: true };
}

export async function refreshAvailability(
  listingId?: string,
  force = false,
): Promise<ActionResult> {
  const dates = getTripDates();
  if (!dates.checkIn || !dates.checkOut) {
    return { ok: false, error: "Set trip dates first" };
  }
  if (listingId) {
    const id = cleanString(listingId, 64);
    if (!id) return { ok: false, error: "Missing id" };
    const row = db
      .prepare("select id, url from listings where id = ?")
      .get(id) as { id: string; url: string } | undefined;
    if (!row) return { ok: false, error: "Listing not found" };
    queueOne(row.id, row.url, dates.checkIn, dates.checkOut);
  } else {
    queueAllListings(dates.checkIn, dates.checkOut, force);
  }
  revalidatePath("/");
  return { ok: true };
}

export type BattleResult =
  | { ok: true; battle: Battle }
  | { ok: false; error: string };

export async function createBattle(input: {
  name: string;
  organizerId: string;
  organizerName: string;
  checkIn: string;
  checkOut: string;
  submissionDeadline: string; // ISO datetime, must be in the future
}): Promise<BattleResult> {
  const name = cleanString(input.name, 80);
  const organizerId = cleanString(input.organizerId, VOTER_ID_MAX);
  const organizerName = cleanString(input.organizerName, NAME_MAX);
  const checkIn = cleanString(input.checkIn, 10);
  const checkOut = cleanString(input.checkOut, 10);
  const deadline = cleanString(input.submissionDeadline, 40);

  if (!name) return { ok: false, error: "Name the battle" };
  if (!organizerId) return { ok: false, error: "Sign in first" };
  if (!checkIn || !isValidIsoDate(checkIn)) return { ok: false, error: "Bad check-in date" };
  if (!checkOut || !isValidIsoDate(checkOut)) return { ok: false, error: "Bad check-out date" };
  if (new Date(checkIn) >= new Date(checkOut)) {
    return { ok: false, error: "Check-out must be after check-in" };
  }
  const deadlineMs = new Date(deadline).getTime();
  if (!Number.isFinite(deadlineMs)) return { ok: false, error: "Bad submission deadline" };
  if (deadlineMs <= Date.now()) {
    return { ok: false, error: "Submission deadline must be in the future" };
  }

  // Persist trip dates in the legacy settings too — the existing availability
  // queue + map link rewriting still read from there.
  writeTripDates({ checkIn, checkOut });

  // Claim any pre-existing listings with no owner for the organizer — covers
  // the upgrade path where the user had listings before the battle concept
  // existed, and the case where the organizer was the one adding them all.
  db.prepare(
    "update listings set added_by_id = ?, added_by_name = ? where added_by_id is null",
  ).run(organizerId, organizerName);

  const battle = writeCreateBattle({
    name,
    organizer_id: organizerId,
    organizer_name: organizerName || "anon",
    check_in: checkIn,
    check_out: checkOut,
    submission_deadline: new Date(deadlineMs).toISOString(),
  });

  revalidatePath("/");
  return { ok: true, battle };
}

export async function startBattleNow(organizerId: string): Promise<BattleResult> {
  const current = getCurrentBattle();
  if (!current) return { ok: false, error: "No battle yet" };
  if (cleanString(organizerId, VOTER_ID_MAX) !== current.organizer_id) {
    return { ok: false, error: "Only the organizer can start the battle" };
  }
  const battle = updateBattlePhase("voting");
  if (!battle) return { ok: false, error: "Couldn't start battle" };

  // Kick off availability checks now that everyone's about to see everything.
  if (battle.check_in && battle.check_out) {
    queueAllListings(battle.check_in, battle.check_out);
  }

  revalidatePath("/");
  return { ok: true, battle };
}

export async function updateBattle(input: {
  organizerId: string;
  name?: string;
  submissionDeadline?: string;
  checkIn?: string;
  checkOut?: string;
}): Promise<BattleResult> {
  const current = getCurrentBattle();
  if (!current) return { ok: false, error: "No battle yet" };
  if (cleanString(input.organizerId, VOTER_ID_MAX) !== current.organizer_id) {
    return { ok: false, error: "Only the organizer can edit the battle" };
  }
  const patch: Partial<Battle> = {};
  if (input.name !== undefined) {
    const v = cleanString(input.name, 80);
    if (!v) return { ok: false, error: "Name can't be empty" };
    patch.name = v;
  }
  if (input.checkIn !== undefined) {
    const v = cleanString(input.checkIn, 10);
    if (v && !isValidIsoDate(v)) return { ok: false, error: "Bad check-in date" };
    patch.check_in = v || null;
  }
  if (input.checkOut !== undefined) {
    const v = cleanString(input.checkOut, 10);
    if (v && !isValidIsoDate(v)) return { ok: false, error: "Bad check-out date" };
    patch.check_out = v || null;
  }
  if (input.submissionDeadline !== undefined) {
    const ms = new Date(input.submissionDeadline).getTime();
    if (!Number.isFinite(ms)) return { ok: false, error: "Bad deadline" };
    patch.submission_deadline = new Date(ms).toISOString();
  }
  const battle = patchBattle(patch);
  if (!battle) return { ok: false, error: "Couldn't update battle" };
  if (battle.check_in && battle.check_out) {
    writeTripDates({ checkIn: battle.check_in, checkOut: battle.check_out });
  }
  revalidatePath("/");
  return { ok: true, battle };
}

export async function joinBattle(
  rawCode: string,
  voterId: string,
  voterName: string,
): Promise<ActionResult> {
  const code = normalizeInviteCode(cleanString(rawCode, 32));
  const vid = cleanString(voterId, VOTER_ID_MAX);
  const name = cleanString(voterName, NAME_MAX) || "anon";
  if (!code) return { ok: false, error: "Enter the invite code" };
  if (!vid) return { ok: false, error: "Sign in first" };

  // Rate-limit per voter so brute-forcing the 6-char code is impractical.
  if (!consume(`join:${vid}`, LIMITS.signIn)) {
    return { ok: false, error: "Too many attempts. Wait a moment and try again." };
  }

  const battle = getCurrentBattle();
  if (!battle) return { ok: false, error: "No active battle" };
  if (code !== battle.invite_code) {
    return { ok: false, error: "That code doesn't match. Ask the organizer." };
  }

  addParticipant(battle.id, vid, name);
  revalidatePath("/");
  return { ok: true };
}

export async function leaveBattle(voterId: string): Promise<ActionResult> {
  const vid = cleanString(voterId, VOTER_ID_MAX);
  if (!vid) return { ok: false, error: "Missing id" };
  const battle = getCurrentBattle();
  if (!battle) return { ok: false, error: "No active battle" };
  if (vid === battle.organizer_id) {
    return { ok: false, error: "The organizer can't leave — reset the battle instead." };
  }
  removeParticipant(battle.id, vid);
  revalidatePath("/");
  return { ok: true };
}

export async function regenerateInviteCode(
  organizerId: string,
): Promise<BattleResult> {
  const battle = getCurrentBattle();
  if (!battle) return { ok: false, error: "No active battle" };
  if (cleanString(organizerId, VOTER_ID_MAX) !== battle.organizer_id) {
    return { ok: false, error: "Only the organizer can regenerate the code" };
  }
  const next = writeRegenerateInviteCode();
  if (!next) return { ok: false, error: "Couldn't regenerate" };
  revalidatePath("/");
  return { ok: true, battle: next };
}

export async function kickParticipant(
  organizerId: string,
  participantVoterId: string,
  removeVotes = false,
): Promise<ActionResult> {
  const battle = getCurrentBattle();
  if (!battle) return { ok: false, error: "No active battle" };
  if (cleanString(organizerId, VOTER_ID_MAX) !== battle.organizer_id) {
    return { ok: false, error: "Only the organizer can kick" };
  }
  const target = cleanString(participantVoterId, VOTER_ID_MAX);
  if (!target) return { ok: false, error: "Missing voter" };
  if (target === battle.organizer_id) {
    return { ok: false, error: "Can't kick the organizer" };
  }
  removeParticipant(battle.id, target, removeVotes);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Tear down the entire battle (also clears listings, votes, comments).
 * Only the organizer can do this. Use for "start a new trip" flows.
 */
export async function resetBattle(organizerId: string): Promise<ActionResult> {
  const current = getCurrentBattle();
  if (!current) return { ok: false, error: "No battle yet" };
  if (cleanString(organizerId, VOTER_ID_MAX) !== current.organizer_id) {
    return { ok: false, error: "Only the organizer can reset" };
  }
  // Cascade-deletes votes + comments via FK on listings.
  db.prepare("delete from listings").run();
  db.prepare("delete from places").run();
  db.prepare("delete from participants where battle_id = ?").run(current.id);
  deleteBattle();
  writeTripDates({ checkIn: null, checkOut: null });
  revalidatePath("/");
  return { ok: true };
}

/**
 * Archive the current battle (snapshot winners/scores into past_battles), then
 * wipe the active battle so a new one can start. Organizer-only.
 */
export async function closeBattle(organizerId: string): Promise<ActionResult> {
  const current = getCurrentBattle();
  if (!current) return { ok: false, error: "No battle yet" };
  if (cleanString(organizerId, VOTER_ID_MAX) !== current.organizer_id) {
    return { ok: false, error: "Only the organizer can close the battle" };
  }
  archiveCurrentBattle({
    id: current.id,
    name: current.name,
    check_in: current.check_in,
    check_out: current.check_out,
    organizer_name: current.organizer_name,
    created_at: current.created_at,
  });
  db.prepare("delete from listings").run();
  db.prepare("delete from places").run();
  db.prepare("delete from participants where battle_id = ?").run(current.id);
  deleteBattle();
  writeTripDates({ checkIn: null, checkOut: null });
  revalidatePath("/");
  return { ok: true };
}

export async function deletePastBattle(
  organizerOrCurrentVoterId: string,
  pastBattleId: string,
): Promise<ActionResult> {
  // Anyone signed in can delete a past battle from the trophy case for now
  // (since past battles are read-only and we don't enforce role beyond
  // "is the current organizer if a battle is active"). Tighten later.
  const vid = cleanString(organizerOrCurrentVoterId, VOTER_ID_MAX);
  const id = cleanString(pastBattleId, 64);
  if (!vid || !id) return { ok: false, error: "Missing id" };
  const cur = getCurrentBattle();
  if (cur && vid !== cur.organizer_id) {
    return { ok: false, error: "Only the current organizer can prune past battles" };
  }
  removePastBattle(id);
  revalidatePath("/");
  return { ok: true };
}

const COORD_EPSILON = 0.0015;

function placeAlreadyExists({
  url,
  lat,
  lng,
}: {
  url: string | null;
  lat: number;
  lng: number;
}): boolean {
  if (url) {
    const byUrl = db.prepare("select id from places where url = ?").get(url);
    if (byUrl) return true;
  }
  const nearby = db
    .prepare(
      `select id from places
       where abs(latitude - ?) < ? and abs(longitude - ?) < ?
       limit 1`,
    )
    .get(lat, COORD_EPSILON, lng, COORD_EPSILON);
  return Boolean(nearby);
}
