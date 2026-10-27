"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function TelegramConnect() {
  const [linked, setLinked] = useState(false);
  const [msg, setMsg] = useState("");

  async function check() {
    try {
      const r = await api<{ linked: boolean }>("/api/telegram/status");
      setLinked(r.linked);
    } catch {}
  }

  useEffect(() => { check(); }, []);

  async function connect() {
    try {
      const r = await api<{ url: string }>("/api/telegram/link");
      window.open(r.url, "_blank");
      setMsg("Telegram me 'START' dabayen, phir 'Status check' dabayen.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <h2 className="font-semibold">📲 Telegram alert (free)</h2>
      <p className="text-sm text-gray-500">Alert photo ke saath Telegram par bhi aayega.</p>
      {linked ? (
        <p className="text-sm text-green-700">✅ Telegram juda hua hai.</p>
      ) : (
        <div className="flex gap-2">
          <button onClick={connect} className="bg-sky-600 hover:bg-sky-700 text-white text-sm rounded-lg px-4 py-2">
            Telegram jodein
          </button>
          <button onClick={check} className="bg-gray-200 hover:bg-gray-300 text-sm rounded-lg px-4 py-2">
            Status check
          </button>
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}