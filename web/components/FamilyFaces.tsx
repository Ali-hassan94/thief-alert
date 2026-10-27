"use client";

import { useEffect, useState } from "react";
import { descriptorFrom, getFaces, saveFaces, type Face } from "@/lib/faces";

export default function FamilyFaces() {
  const [faces, setFaces] = useState<Face[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setFaces(getFaces()); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!name.trim()) return setMsg("Pehle naam likhein.");
    setBusy(true);
    setMsg("Chehra pehchana ja raha hai (pehli dafa 10-20 second)...");
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();
      const d = await descriptorFrom(img);
      if (!d) setMsg("Photo me saaf chehra nahi mila. Seedhi, roshan photo lagayen.");
      else {
        const next = [...faces, { name: name.trim(), d }];
        saveFaces(next);
        setFaces(next);
        setName("");
        setMsg("✅ Add ho gaya.");
      }
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    }
    setBusy(false);
  }

  function remove(i: number) {
    const next = faces.filter((_, k) => k !== i);
    saveFaces(next);
    setFaces(next);
  }

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <h2 className="font-semibold">👤 Ghar ke afraad (whitelist)</h2>
      <p className="text-sm text-gray-500">
        Inhe pehchan kar alert nahi jayega. Photo sirf <b>is device</b> par rehti hai, kahin upload nahi hoti.
        Ye us device par karein jis par Detector chalta hai.
      </p>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam (jaise Abbu)"
          className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <label className={`bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg px-4 py-2 cursor-pointer ${busy ? "opacity-50" : ""}`}>
          📷 Photo
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={onFile} />
        </label>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
      <ul className="space-y-1">
        {faces.map((f, i) => (
          <li key={i} className="flex justify-between text-sm border rounded-lg px-3 py-1">
            <span>🏠 {f.name}</span>
            <button onClick={() => remove(i)} className="text-gray-500 underline">Hatayen</button>
          </li>
        ))}
      </ul>
    </div>
  );
}