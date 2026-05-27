"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { removePlace, addPlaceAtCoords } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import { withTripDates, type TripDates } from "@/lib/trip";
import { shortDisplayName } from "@/lib/title";
import { confirmDialog } from "./Modal";
import type { ListingWithStats, Place } from "@/lib/types";

// Default fallback icon (the standard leaflet teardrop) — only used if a
// listing has no availability status info at all.
const ListingIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = ListingIcon;

/**
 * Brand-color teardrop pin per availability status. Booked listings get a
 * rose pin with a big white ✕ so they're instantly distinguishable from
 * available ones on a crowded map — they still show on the map (the user
 * may want to look at the location for context) but visually shouted as
 * NOT options.
 */
function listingPin(status: "available" | "unavailable" | "unknown") {
  const fill =
    status === "available"
      ? "#10C8D2"
      : status === "unavailable"
        ? "#FF6C51"
        : "#a1a1aa";
  // SVG teardrop, 25w × 41h to match Leaflet's stock marker so the anchor
  // math doesn't shift. The ✕ overlay only appears on booked.
  const xMark =
    status === "unavailable"
      ? `<path d="M9 16 L16 23 M16 16 L9 23" stroke="white" stroke-width="2.5" stroke-linecap="round"/>`
      : "";
  return L.divIcon({
    className: "",
    html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
      <path d="M12.5 1 C 6 1 1 6 1 12.5 C 1 22 12.5 40 12.5 40 C 12.5 40 24 22 24 12.5 C 24 6 19 1 12.5 1 Z" fill="${fill}" stroke="white" stroke-width="1.5"/>
      <circle cx="12.5" cy="12.5" r="4" fill="white" fill-opacity="${status === "unavailable" ? "0" : "0.85"}"/>
      ${xMark}
    </svg>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

// Reference-place marker. NOTE: divIcon's `html` is interpreted as raw HTML —
// only put static markup here. Never interpolate user-controlled strings into
// this template or you've created a stored-XSS sink.
const PlaceIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 18px; height: 18px; border-radius: 50%;
    background: #fbbf24; border: 2px solid white;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [map, points]);
  return null;
}

function isSafeUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Drops a pin on the map at the next click. Only mounts while drop-pin
 * mode is on. Stops propagation so the click doesn't trigger other map
 * handlers. Tracks lat/lng via the callback.
 */
function MapClickCapture({
  active,
  onPick,
}: {
  active: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Dashed teardrop preview while the user is naming a freshly-dropped pin. */
const PendingPinIcon = L.divIcon({
  className: "",
  html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
    <path d="M12.5 1 C 6 1 1 6 1 12.5 C 1 22 12.5 40 12.5 40 C 12.5 40 24 22 24 12.5 C 24 6 19 1 12.5 1 Z" fill="#fbbf24" stroke="white" stroke-width="1.5" stroke-dasharray="3 2"/>
    <circle cx="12.5" cy="12.5" r="4" fill="white"/>
  </svg>`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

/** Friendly "5 min ago" string for popup timestamps. */
function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function MapView({
  listings,
  places,
  tripDates,
}: {
  listings: ListingWithStats[];
  places: Place[];
  tripDates: TripDates;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [isRemoving, startRemove] = useTransition();

  // Drop-pin mode state. The flow:
  //   click "Drop a pin" → dropPinMode = true (cursor changes)
  //   click anywhere on the map → pendingPin set to lat/lng, dropPinMode off
  //   inline form opens at the pending pin → type name + optional URL
  //   submit → addPlaceAtCoords → server inserts → page refresh
  //   cancel → pendingPin cleared, nothing committed
  const [dropPinMode, setDropPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingUrl, setPendingUrl] = useState("");
  const [isAddingPlace, startAddPlace] = useTransition();

  const handleMapClick = (lat: number, lng: number) => {
    setPendingPin({ lat, lng });
    setDropPinMode(false);
    setPendingName("");
    setPendingUrl("");
  };

  const cancelPendingPin = () => {
    setPendingPin(null);
    setPendingName("");
    setPendingUrl("");
  };

  const submitPendingPin = () => {
    if (!pendingPin) return;
    const name = pendingName.trim();
    if (!name) return;
    startAddPlace(async () => {
      const res = await addPlaceAtCoords(
        name,
        pendingUrl.trim() || null,
        pendingPin.lat,
        pendingPin.lng,
        voter?.name || "",
      );
      if (res.ok) {
        cancelPendingPin();
        router.refresh();
      }
    });
  };

  const placedListings = useMemo(
    () =>
      listings.filter(
        (l): l is ListingWithStats & { latitude: number; longitude: number } =>
          typeof l.latitude === "number" && typeof l.longitude === "number",
      ),
    [listings],
  );

  const allPoints = useMemo<[number, number][]>(
    () => [
      ...placedListings.map((l) => [l.latitude, l.longitude] as [number, number]),
      ...places.map((p) => [p.latitude, p.longitude] as [number, number]),
    ],
    [placedListings, places],
  );

  const initialCenter = useRef<[number, number]>([20, 0]);

  if (allPoints.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-zinc-700 text-sm text-zinc-400">
        No locations to map yet.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800">
      {/* Drop-pin toggle button — floats over the top-right of the map.
          When active, cursor changes to crosshair via CSS. Disabled while
          a pin is pending (you can only confirm/cancel that one first). */}
      <button
        type="button"
        onClick={() => setDropPinMode((v) => !v)}
        disabled={!!pendingPin || !voter}
        className={`absolute right-3 top-3 z-[1000] inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
          dropPinMode
            ? "border-[#fbbf24] bg-[#fbbf24] text-[#3a2a04] shadow-lg"
            : "border-zinc-700 bg-zinc-950/80 text-zinc-200 backdrop-blur hover:border-[#fbbf24]/60 hover:text-[#fbbf24]"
        }`}
        title={
          dropPinMode
            ? "Click anywhere on the map to drop a pin, or click here again to cancel"
            : "Click to enter drop-pin mode, then click on the map where you want a reference pin"
        }
      >
        {dropPinMode ? "❌ cancel" : "📍 drop a pin"}
      </button>
      <MapContainer
        center={initialCenter.current}
        zoom={2}
        scrollWheelZoom={false}
        style={{
          height: "min(70vh, 720px)",
          minHeight: 480,
          width: "100%",
          cursor: dropPinMode ? "crosshair" : undefined,
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />
        <MapClickCapture active={dropPinMode} onPick={handleMapClick} />

        {pendingPin && (
          <Marker
            position={[pendingPin.lat, pendingPin.lng]}
            icon={PendingPinIcon}
            ref={(m) => {
              // Auto-open the popup as soon as the marker mounts so the
              // user doesn't have to click again to type the name.
              if (m) {
                requestAnimationFrame(() => m.openPopup());
              }
            }}
          >
            <Popup
              autoClose={false}
              closeOnClick={false}
              closeButton={false}
            >
              <div className="flex w-56 flex-col gap-2">
                <p className="text-sm font-semibold leading-tight">Name this spot</p>
                <input
                  autoFocus
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitPendingPin();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelPendingPin();
                    }
                  }}
                  placeholder="e.g. Disney World"
                  maxLength={120}
                  className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-400"
                />
                <input
                  value={pendingUrl}
                  onChange={(e) => setPendingUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitPendingPin();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelPendingPin();
                    }
                  }}
                  placeholder="optional URL"
                  maxLength={500}
                  className="w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-400"
                />
                <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                  {pendingPin.lat.toFixed(4)}, {pendingPin.lng.toFixed(4)}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelPendingPin}
                    className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitPendingPin}
                    disabled={!pendingName.trim() || isAddingPlace}
                    className="rounded-sm border border-rose-500/60 bg-rose-500/15 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/25 disabled:opacity-40"
                  >
                    {isAddingPlace ? "saving…" : "save pin"}
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {placedListings.map((l) => {
          // Resolve effective status the same way the roster does:
          // organizer overrides win, then the auto-check, default to "unknown".
          const status: "available" | "unavailable" | "unknown" =
            l.availability_override_status === "available"
              ? "available"
              : l.availability_override_status === "unavailable"
                ? "unavailable"
                : l.availability_override
                  ? "available"
                  : l.availability_status === "available"
                    ? "available"
                    : l.availability_status === "unavailable"
                      ? "unavailable"
                      : "unknown";
          return (
          <Marker
            key={l.id}
            position={[l.latitude, l.longitude]}
            title={l.title || "Listing"}
            icon={listingPin(status)}
          >
            <Popup>
              <div className="flex w-56 flex-col gap-1">
                {l.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.image_url}
                    alt={l.title || "listing"}
                    className="h-24 w-full rounded object-cover"
                  />
                )}
                {isSafeUrl(l.url) ? (
                  <a
                    href={withTripDates(l.url, tripDates)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={l.title || "Untitled listing"}
                    className="text-sm font-semibold leading-tight hover:underline"
                  >
                    {shortDisplayName(l.title, l.location)}
                  </a>
                ) : (
                  <span className="text-sm font-semibold leading-tight">
                    {shortDisplayName(l.title, l.location)}
                  </span>
                )}
                <p className="text-xs">
                  Score:{" "}
                  <span
                    className={
                      l.score == null
                        ? "text-neutral-400"
                        : l.score >= 4
                          ? "text-[#10C8D2]"
                          : l.score <= 2
                            ? "text-[#FF6C51]"
                            : "text-neutral-300"
                    }
                  >
                    {l.score == null ? "—" : `${l.score.toFixed(1)} / 5`}
                  </span>
                  {l.rating != null && (
                    <>
                      <span className="mx-1">·</span>★ {l.rating.toFixed(2)}
                    </>
                  )}
                </p>
              </div>
            </Popup>
          </Marker>
          );
        })}

        {places.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={PlaceIcon}
            title={p.name}
          >
            <Popup>
              <div className="flex w-52 flex-col gap-1.5">
                <p className="text-sm font-semibold leading-tight">{p.name}</p>
                <div className="flex flex-col gap-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  <span>
                    📌 reference pin
                    {p.added_by_name && (
                      <>
                        <span className="mx-1">·</span>added by{" "}
                        <span className="text-zinc-300">{p.added_by_name}</span>
                      </>
                    )}
                  </span>
                  {p.created_at && (
                    <span>{relativeTime(p.created_at)}</span>
                  )}
                </div>
                {isSafeUrl(p.url) && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs text-rose-400 hover:underline"
                  >
                    {p.url}
                  </a>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-400 hover:text-rose-300"
                    title="Get directions in Google Maps"
                  >
                    directions ↗
                  </a>
                  <button
                    type="button"
                    disabled={isRemoving}
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: `Remove "${p.name}"?`,
                        body: "This takes the pin off the map for everyone.",
                        confirm: "Remove",
                        tone: "danger",
                      });
                      if (!ok) return;
                      startRemove(async () => {
                        await removePlace(p.id);
                        router.refresh();
                      });
                    }}
                    aria-label={`Remove ${p.name} from the map`}
                    className="text-xs text-zinc-300 hover:text-rose-400"
                  >
                    remove
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
