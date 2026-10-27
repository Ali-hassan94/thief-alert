"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api, type AlertItem } from "@/lib/api";

const HeatMap = dynamic(() => import("@/components/HeatMap"), {
  ssr: false,
  loading: () => <div className="h-[400px] rounded-xl bg-gray-200 animate-pulse" />,
});

export default function HeatmapPage() {
  const router = useRouter();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login");
      try {
        setItems(await api<AlertItem[]>("?days=30"));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [router]);

  const hours = Array.from({ length: 24 }, () => 0);
  items.forEach((a) => hours[new Date(a.createdAt).getHours()]++);
  const max = Math.max(1, ...hours);

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🗺️ Pichle 30 din ka naqsha</h1>
          <Link href="/dashboard" className="text-sm bg-gray-200 rounded-lg px-3 py-1">← Wapis</Link>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <p className="text-sm text-gray-600">{items.length} alerts. Jahan laal gehra, wahan zyada.</p>
        <HeatMap points={items.map((a) => [a.lat, a.lng] as [number, number])} />

        <div>
          <p className="text-sm font-semibold mb-2">⏰ Kis waqt zyada hota hai</p>
          <div className="flex items-end gap-[2px] h-24">
            {hours.map((c, h) => (
              <div key={h} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-full bg-red-500 rounded-t" style={{ height: `${(c / max) * 100}%` }} title={`${h}:00 - ${c}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
        </div>
      </div>
    </main>
  );
}