"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api, type AlertItem } from "@/lib/api";

export default function GalleryPage() {
  const router = useRouter();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login");
      try {
        const all = await api<AlertItem[]>("/alerts?days=30");
        setItems(all.filter((a) => a.photoUrl));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [router]);

  async function remove(id: string) {
    if (!confirm("Ye tasveer aur alert delete karein?")) return;
    try {
      await api(`/alerts/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">📸 Chor ki tasaweer</h1>
          <Link href="/dashboard" className="text-sm bg-gray-200 rounded-lg px-3 py-1">← Wapis</Link>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {items.length === 0 && !error && <p className="text-gray-500">Abhi koi tasveer nahi.</p>}
        <div className="grid grid-cols-2 gap-3">
          {items.map((a) => (
            <div key={a.id} className="border rounded-xl overflow-hidden">
              <Link href={`/alert?id=${a.id}`} className="block">
                <img src={a.photoUrl!} alt="" className="w-full h-36 object-cover" />
                <p className="text-xs text-gray-600 p-2">{new Date(a.createdAt).toLocaleString()}</p>
              </Link>
              {a.mine && (
                <button
                  onClick={() => remove(a.id)}
                  className="w-full text-xs text-red-600 py-2 border-t hover:bg-red-50"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}