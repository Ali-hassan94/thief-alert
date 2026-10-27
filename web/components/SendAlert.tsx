// web/components/SendAlert.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="h-[400px] rounded-xl bg-gray-200 animate-pulse" />,
});

export default function SendAlert() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function getGps() {
    if (!navigator.geolocation) return setMsg("Browser location support nahi karta.");
    setMsg("Location dhoondi ja rahi hai...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setMsg("");
      },
      () => setMsg("Location nahi mili. Permission allow karein."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function send() {
    if (!pos) return setMsg("Pehle chor ki location chunein.");
    if (!confirm("Kya aap waqai is location par chor ka alert bhejna chahte hain? Jhoota alert na dein.")) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await api<{ id: string; notified: number }>("", {
        method: "POST",
        body: JSON.stringify({ lat: pos[0], lng: pos[1], description: desc }),
      });
      setMsg(`🚨 Alert bhej diya gaya. ${res.notified} logon ko notification gayi.`);
      setDesc("");
      setOpen(false);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  return (
    <div className="border-2 border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-red-700">🚨 Chor Alert bhejein</h2>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-3"
        >
          🚨 Chor dekha? Alert bhejein
        </button>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Chor ki location chunein: map par click karein, ya apni current location use karein.
          </p>
          <button onClick={getGps} className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg px-4 py-2">
            📌 Meri current location
          </button>

          <MapPicker position={pos} radius={100} onPick={(lat, lng) => setPos([lat, lng])} />

          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Chhoti detail (jaise: kala motorcycle, 2 log, gali no. 5)"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400"
          />

          <div className="flex gap-2">
            <button
              onClick={send}
              disabled={busy || !pos}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2 disabled:opacity-50"
            >
              {busy ? "Bheja ja raha hai..." : "🚨 Alert bhejein"}
            </button>
            <button onClick={() => setOpen(false)} className="bg-gray-200 hover:bg-gray-300 rounded-lg px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </>
      )}

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}