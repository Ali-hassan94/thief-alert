"use client";

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function HeatMap({ points }: { points: [number, number][] }) {
  const center: [number, number] = points[0] ?? [30.3753, 69.3451];
  return (
    <MapContainer center={center} zoom={points.length ? 14 : 5} className="h-[400px] w-full rounded-xl z-0">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map((p, i) => (
        <CircleMarker key={i} center={p} radius={22}
          pathOptions={{ color: "#dc2626", weight: 0, fillColor: "#dc2626", fillOpacity: 0.25 }} />
      ))}
    </MapContainer>
  );
}