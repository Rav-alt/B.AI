"use client";
// Leaflet map of one itinerary (DESIGN.md §6 Map card). Loaded client-only by MapCard.
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import type { Itinerary, LatLon, PlaceRef } from "@/lib/types";
import { cssVar, isRide, modeColor } from "@/lib/ui/route-view";

const pin = (cls: string, letter: string) =>
  L.divIcon({ className: "", html: `<span class="bai-pin ${cls}">${letter}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });

function FitBounds({ points }: { points: LatLon[] }) {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>'); // no flag icon
  }, [map]);
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points.map(([a, b]) => L.latLng(a, b))), { padding: [28, 28], maxZoom: 17 });
  }, [map, points]);
  return null;
}

export interface RouteMapProps {
  itinerary: Itinerary;
  origin: PlaceRef;
  destination: PlaceRef;
  /** Full-screen map: allow scroll-wheel zoom. */
  full?: boolean;
  label: string;
}

export default function RouteMap({ itinerary, origin, destination, full = false, label }: RouteMapProps) {
  const points = useMemo<LatLon[]>(
    () => [[origin.lat, origin.lon], ...itinerary.legs.flatMap((l) => l.polyline), [destination.lat, destination.lon]],
    [itinerary, origin, destination],
  );
  const icons = useMemo(() => ({ a: pin("bai-pin-a", "A"), b: pin("bai-pin-b", "B") }), []);
  const walk = modeColor("walk");

  return (
    <div role="img" aria-label={label} className="h-full w-full">
      <MapContainer
        center={[origin.lat, origin.lon]}
        zoom={14}
        scrollWheelZoom={full}
        attributionControl
        className="h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        {itinerary.legs.map((l, i) =>
          l.mode === "walk" ? (
            <Polyline key={i} positions={l.polyline} pathOptions={{ color: walk, weight: 3, dashArray: "4 4", lineCap: "round" }} />
          ) : (
            <Polyline key={i} positions={l.polyline} pathOptions={{ color: modeColor(l.mode), weight: 5, lineCap: "round", lineJoin: "round" }} />
          ),
        )}
        {itinerary.legs.filter(isRide).flatMap((l, i) =>
          [l.boardStop, l.alightStop].map((s, j) => (
            <CircleMarker
              key={`${i}-${j}`}
              center={[s.lat, s.lon]}
              radius={5}
              pathOptions={{ color: modeColor(l.mode), weight: 3, fillColor: cssVar("--paper"), fillOpacity: 1 }}
            />
          )),
        )}
        <Marker position={[origin.lat, origin.lon]} icon={icons.a} keyboard={false} />
        <Marker position={[destination.lat, destination.lon]} icon={icons.b} keyboard={false} />
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
