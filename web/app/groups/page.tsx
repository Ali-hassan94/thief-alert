"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

type Group = { id: string; name: string; code: string; members: number };

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      setGroups(await api<Group[]>("/api/groups"));
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function create() {
    try {
      await api("/api/groups", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      setMsg("");
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function join() {
    try {
      await api("/api/groups/join", { method: "POST", body: JSON.stringify({ code }) });
      setCode("");
      setMsg("");
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function leave(id: string) {
    if (!confirm("Group chhorna chahte hain?")) return;
    await api(`/api/groups/${id}/leave`, { method: "POST" });
    load();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">🧑‍🤝‍🧑 Mohalla group</h1>
          <Link href="/dashboard" className="text-sm bg-gray-200 rounded-lg px-3 py-1">← Wapis</Link>
        </div>
        <p className="text-sm text-gray-600">
          Group ke kisi bhi member ka alert sab members ko jata hai, chahe wo kitna bhi door ho.
          Padosiyon ko apna invite code dein.
        </p>

        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naya group (jaise Gali 5)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button onClick={create} className="bg-red-600 text-white rounded-lg px-4 text-sm">Banayen</button>
        </div>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code"
            className="flex-1 border rounded-lg px-3 py-2 text-sm uppercase" />
          <button onClick={join} className="bg-blue-600 text-white rounded-lg px-4 text-sm">Join</button>
        </div>
        {msg && <p className="text-red-600 text-sm">{msg}</p>}

        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id} className="border rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm text-gray-600">{g.members} members · Code: <b>{g.code}</b></p>
              </div>
              <button onClick={() => leave(g.id)} className="text-sm text-gray-500 underline">Chhorein</button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}