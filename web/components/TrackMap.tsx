"use client";

import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CDN = "https://unpkg.com/leaflet@1.9.4/dist/images";
const icon = L.icon({
  iconUrl: `${CDN}/marker-icon.png`,
  iconRetinaUrl: `${CDN}/marker-icon-2x.png`,
  shadowUrl: `${CDN}/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type P = [number, number];

function Clicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function TrackMap({
  origin, points, pending, onPick,
}: { origin: P; points: P[]; pending: P | null; onPick: (lat: number, lng: number) => void }) {
  const line: P[] = [origin, ...points];
  return (
    <MapContainer center={origin} zoom={16} className="h-[400px] w-full rounded-xl z-0">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Clicker onPick={onPick} />
      <Marker position={origin} icon={icon} />
      {points.length > 0 && <Polyline positions={line} pathOptions={{ color: "#dc2626", weight: 4, dashArray: "8" }} />}
      {points.map((p, i) => (
        <CircleMarker key={i} center={p} radius={7} pathOptions={{ color: "#dc2626", fillColor: "#fff", fillOpacity: 1 }} />
      ))}
      {pending && <CircleMarker center={pending} radius={9} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.6 }} />}
    </MapContainer>
  );
}