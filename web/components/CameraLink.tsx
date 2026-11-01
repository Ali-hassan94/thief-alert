"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function CameraLink() {
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const base = `${process.env.NEXT_PUBLIC_API_URL}/hook/`;

  useEffect(() => {
    api<{ token: string | null }>("/camera-link").then((r) => setToken(r.token)).catch(() => {});
  }, []);

  async function create() {
    if (token && !confirm("Naya link banane se purana band ho jayega. Jari rakhein?")) return;
    try {
      const r = await api<{ token: string }>("/camera-link", { method: "POST" });
      setToken(r.token);
      setMsg("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(base + token);
    setMsg("✅ Link copy ho gaya.");
  }

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <h2 className="font-semibold">🔗 Camera link (CCTV / WiFi camera ke liye)</h2>
      <p className="text-sm text-gray-500">
        Apne camera ya IFTTT me "motion par ye link call karo" set karein. Alert foran aap ke mobile par aayega.
        Ye link kisi ko na dein.
      </p>
      {token && <p className="text-xs break-all bg-gray-100 rounded p-2">{base + token}</p>}
      <div className="flex gap-2">
        <button onClick={create} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg px-4 py-2">
          {token ? "Naya link banayen" : "Link banayen"}
        </button>
        {token && (
          <button onClick={copy} className="bg-gray-200 hover:bg-gray-300 text-sm rounded-lg px-4 py-2">
            Copy
          </button>
        )}
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}