"use client";
// Leaflet map for "Pin sa mapa": the pin sits fixed at the map's center and the map moves under it
// (drag, tap a spot to center it, or arrow keys when the map is focused), so it works with a keyboard too.
// Loaded client-only by FollowUp.
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

export interface PinMapProps {
  center: { lat: number; lon: number };
  zoom: number;
  /** "A" for the starting point, "B" for the destination (same pins as the route map). */
  letter: "A" | "B";
  onMove: (center: { lat: number; lon: number }) => void;
  label: string;
}

function Track({ onMove }: { onMove: PinMapProps["onMove"] }) {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    const c = map.getCenter();
    onMove({ lat: c.lat, lon: c.lng });
  }, [map, onMove]);
  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMove({ lat: c.lat, lon: c.lng });
    },
    click: (e) => map.panTo(e.latlng),
  });
  return null;
}

export default function PinMap({ center, zoom, letter, onMove, label }: PinMapProps) {
  return (
    <div className="relative h-full w-full">
      <MapContainer center={[center.lat, center.lon]} zoom={zoom} keyboard className="h-full w-full" aria-label={label}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <Track onMove={onMove} />
      </MapContainer>
      <span
        aria-hidden="true"
        className={`bai-pin ${letter === "A" ? "bai-pin-a" : "bai-pin-b"} pointer-events-none absolute top-1/2 left-1/2 z-[500] -translate-x-1/2 -translate-y-1/2`}
      >
        {letter}
      </span>
    </div>
  );
}
