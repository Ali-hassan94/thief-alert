"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api, formatDistance, type AlertItem } from "@/lib/api";
import SirenOverlay from "@/components/SirenOverlay";

const TrackMap = dynamic(() => import("@/components/TrackMap"), {
  ssr: false,
  loading: () => <div className="h-[400px] rounded-xl bg-gray-200 animate-pulse" />,
});

type Sighting = { lat: number; lng: number; createdAt: string };

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [alert, setAlert] = useState<AlertItem | null>(null);
  const [error, setError] = useState("");
  const [siren, setSiren] = useState(true);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [pending, setPending] = useState<[number, number] | null>(null);
  const [msg, setMsg] = useState("");

  async function loadSightings() {
    try {
      setSightings(await api<Sighting[]>(`/api/alerts/${id}/sightings`));
    } catch {}
  }

  useEffect(() => {
    let timer: number | undefined;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login");
      try {
        setAlert(await api<AlertItem>(`/api/alerts/${id}`));
        loadSightings();
        timer = window.setInterval(loadSightings, 10000);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => { if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function resolve() {
    try {
      await api(`/api/alerts/${id}/resolve`, { method: "POST" });
      setAlert((a) => (a ? { ...a, status: "resolved" } : a));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function vote(v: "confirm" | "fake") {
    try {
      await api(`/api/alerts/${id}/vote`, { method: "POST", body: JSON.stringify({ vote: v }) });
      setAlert(await api<AlertItem>(`/api/alerts/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendSighting() {
    if (!pending) return;
    try {
      await api(`/api/alerts/${id}/sighting`, {
        method: "POST",
        body: JSON.stringify({ lat: pending[0], lng: pending[1] }),
      });
      setPending(null);
      setMsg("✅ Chor ki location add ho gayi.");
      loadSightings();
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      {siren && alert?.status === "active" && <SirenOverlay onClose={() => setSiren(false)} />}

      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🚨 Chor Alert</h1>
          <Link href="/alerts" className="text-sm bg-gray-200 hover:bg-gray-300 rounded-lg px-3 py-1">
            ← Sab alerts
          </Link>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!alert && !error && <p className="text-gray-500">Loading...</p>}

        {alert && (
          <>
            <div className="text-sm space-y-1">
              <p className={alert.status === "active" ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                {alert.status === "active" ? "🔴 Active" : "🟢 Resolved"}
              </p>
              <p className="text-gray-600">{new Date(alert.createdAt).toLocaleString()}</p>
              {alert.distanceM != null && (
                <p className="text-gray-600">Aap ke zone se {formatDistance(alert.distanceM)} door</p>
              )}
              {alert.description && <p className="text-base mt-2">{alert.description}</p>}
            </div>

            {alert.photoUrl && (
              <img src={alert.photoUrl} alt="Mushtabah insaan" className="w-full rounded-xl border" />
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">🔁 Chor ka raasta ({sightings.length} sightings)</p>
              <TrackMap
                origin={[alert.lat, alert.lng]}
                points={sightings.map((s) => [s.lat, s.lng] as [number, number])}
                pending={pending}
                onPick={(lat, lng) => setPending([lat, lng])}
              />
              {alert.status === "active" && (
                <>
                  <p className="text-xs text-gray-500">Map par jahan chor ko dekha wahan click karein, phir bhejein.</p>
                  <button
                    onClick={sendSighting}
                    disabled={!pending}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm disabled:opacity-50"
                  >
                    📍 Chor yahan dekha gaya
                  </button>
                </>
              )}
              {msg && <p className="text-sm">{msg}</p>}
            </div>

            <a
              href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
              target="_blank"
              rel="noreferrer"
              className="block text-center bg-gray-700 hover:bg-gray-800 text-white rounded-lg py-2 text-sm"
            >
              🗺️ Google Maps me kholen
            </a>

            <div className="border rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold">👥 Padosiyon ki raye</p>
              <p className="text-sm text-gray-600">
                ✅ {alert.confirms} ne dekha &nbsp; | &nbsp; ❌ {alert.fakes} ne jhoota kaha
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => vote("confirm")}
                  className={`flex-1 rounded-lg py-2 text-sm text-white ${alert.myVote === "confirm" ? "bg-green-800" : "bg-green-600 hover:bg-green-700"}`}
                >
                  ✅ Maine bhi dekha
                </button>
                <button
                  onClick={() => vote("fake")}
                  className={`flex-1 rounded-lg py-2 text-sm text-white ${alert.myVote === "fake" ? "bg-gray-800" : "bg-gray-500 hover:bg-gray-600"}`}
                >
                  ❌ Jhoota alert
                </button>
              </div>
            </div>

            {alert.mine && alert.status === "active" && (
              <button onClick={resolve} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 text-sm">
                ✅ Masla hal ho gaya (Resolved)
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}