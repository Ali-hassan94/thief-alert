// web/app/alerts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api, formatDistance, type AlertItem } from "@/lib/api";

export default function AlertsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AlertItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login");
      try {
        setItems(await api<AlertItem[]>(""));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">📋 Pichle 7 din ke alerts</h1>
          <Link href="/dashboard" className="text-sm bg-gray-200 hover:bg-gray-300 rounded-lg px-3 py-1">
            ← Wapis
          </Link>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!items && !error && <p className="text-gray-500">Loading...</p>}
        {items && items.length === 0 && (
          <p className="text-gray-500">Abhi koi alert nahi. Alhamdulillah! 🙏</p>
        )}

        <ul className="space-y-3">
          {items?.map((a) => (
            <li key={a.id}>
              <Link href={`/alert/${a.id}`} className="block border rounded-xl p-3 hover:bg-gray-50">
              {a.photoUrl && (
  <img src={a.photoUrl} alt="Mushtabah insaan" className="w-full h-40 object-cover rounded-lg mb-2" />
)}
                <div className="flex items-center justify-between text-sm">
                  <span className={a.status === "active" ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                    {a.status === "active" ? "🔴 Active" : "🟢 Resolved"}
                    {a.mine && " (aap ka)"}
                  </span>
                  <span className="text-gray-500">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
                {a.distanceM != null && (
                  <p className="text-sm text-gray-600 mt-1">Aap ke zone se {formatDistance(a.distanceM)} door</p>
                )}
                {a.description && <p className="text-sm mt-1">{a.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}