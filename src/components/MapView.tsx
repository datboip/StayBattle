"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { removePlace } from "@/app/actions";
import { withTripDates, type TripDates } from "@/lib/trip";
import { shortDisplayName } from "@/lib/title";
import { confirmDialog } from "./Modal";
import type { ListingWithStats, Place } from "@/lib/types";

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
  const [isRemoving, startRemove] = useTransition();

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
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <MapContainer
        center={initialCenter.current}
        zoom={2}
        scrollWheelZoom={false}
        style={{
          height: "min(70vh, 720px)",
          minHeight: 480,
          width: "100%",
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />

        {placedListings.map((l) => (
          <Marker
            key={l.id}
            position={[l.latitude, l.longitude]}
            title={l.title || "Listing"}
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
        ))}

        {places.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={PlaceIcon}
            title={p.name}
          >
            <Popup>
              <div className="flex w-48 flex-col gap-1">
                <p className="text-sm font-semibold leading-tight">{p.name}</p>
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
                  className="self-start text-xs text-zinc-300 hover:text-rose-400"
                >
                  remove
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
