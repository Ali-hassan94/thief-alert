// web/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import NotificationButton from "@/components/NotificationButton";
import SendAlert from "@/components/SendAlert";
import { unsubscribeFromPush, pushSupported } from "@/lib/push";
import DetectorPanel from "@/components/DetectorPanel";
import TelegramConnect from "@/components/TelegramConnect";
import FamilyFaces from "@/components/FamilyFaces";


const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="h-[400px] rounded-xl bg-gray-200 animate-pulse" />,
});

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const [position, setPosition] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(2000);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUser(data.session.user);
      setChecking(false);

      const { data: zone } = await supabase.rpc("get_my_zone");
      if (zone && zone.length > 0) {
        setPosition([zone[0].lat, zone[0].lng]);
        setRadius(zone[0].radius_m);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage("Aap ka browser location support nahi karta.");
      return;
    }
    setMessage("Location dhoondi ja rahi hai...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setMessage("");
      },
      () => setMessage("Location nahi mili. Browser me location permission allow karein."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function saveZone() {
    if (!position) {
      setMessage("Pehle map par location select karein.");
      return;
    }
    setSaving(true);
    setMessage("");
    const { error } = await supabase.rpc("save_zone", {
      p_name: "Mera Zone",
      p_lat: position[0],
      p_lng: position[1],
      p_radius: radius,
    });
    setSaving(false);
    setMessage(error ? `Error: ${error.message}` : "✅ Zone save ho gaya!");
  }

  async function logout() {
    try {
      if (pushSupported()) await unsubscribeFromPush();
    } catch {}
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (checking) {
    return <main className="min-h-screen flex items-center justify-center">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🚨 Dashboard</h1>
          <button onClick={logout} className="text-sm bg-gray-200 hover:bg-gray-300 rounded-lg px-3 py-1">
            Logout
          </button>
        </div>
        <p className="text-gray-700 text-sm">{user?.email}</p>

        <div>
          <h2 className="font-semibold">📍 Apna Zone chunein</h2>
          <p className="text-gray-500 text-sm">
            Map par click karein, ya "Meri location" dabayen. Is zone me alert aane par aap ko notification milegi.
          </p>
        </div>

        <button
          onClick={useMyLocation}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg px-4 py-2"
        >
          📌 Meri location use karein
        </button>

        <MapPicker position={position} radius={radius} onPick={(lat, lng) => setPosition([lat, lng])} />

        <div>
          <label className="text-sm font-medium">
            Radius: {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
          </label>
          <input
            type="range"
            min={500}
            max={5000}
            step={100}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-red-600"
          />
        </div>

        <button
          onClick={saveZone}
          disabled={saving || !position}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2 disabled:opacity-50"
        >
          {saving ? "Save ho raha hai..." : "💾 Zone save karein"}
        </button>

        {message && <p className="text-sm text-center">{message}</p>}

        <NotificationButton />
        <TelegramConnect />
<FamilyFaces />

<Link href="/groups" className="block text-center border rounded-lg py-2 text-sm hover:bg-gray-50">
  🧑‍🤝‍🧑 Mohalla group
</Link>
<DetectorPanel />
        <SendAlert />
        <Link href="/gallery" className="block text-center border rounded-lg py-2 text-sm hover:bg-gray-50">
  📸 Chor ki tasaweer (gallery)
</Link>

        <Link
          href="/alerts"
          className="block text-center border rounded-lg py-2 text-sm hover:bg-gray-50"
        >
          📋 Mere ilaqe ke alerts dekhein
        </Link>
        <Link href="/heatmap" className="block text-center border rounded-lg py-2 text-sm hover:bg-gray-50">
  🗺️ Ilaqe ka heatmap
</Link>
      </div>
    </main>
  );
}