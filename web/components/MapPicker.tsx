// web/components/MapPicker.tsx
"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CDN = "https://unpkg.com/leaflet@1.9.4/dist/images";
const markerIcon = L.icon({
  iconUrl: `${CDN}/marker-icon.png`,
  iconRetinaUrl: `${CDN}/marker-icon-2x.png`,
  shadowUrl: `${CDN}/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type Props = {
  position: [number, number] | null;
  radius: number;
  onPick: (lat: number, lng: number) => void;
};

function ClickHandler({ onPick }: { onPick: Props["onPick"] }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 14));
  }, [position, map]);
  return null;
}

export default function MapPicker({ position, radius, onPick }: Props) {
  return (
    <MapContainer
      center={position ?? [30.3753, 69.3451]}
      zoom={position ? 14 : 5}
      className="h-[400px] w-full rounded-xl z-0"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <FlyTo position={position} />
      {position && (
        <>
          <Marker position={position} icon={markerIcon} />
          <Circle
            center={position}
            radius={radius}
            pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.15 }}
          />
        </>
      )}
    </MapContainer>
  );
}