"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import Deterrent from "@/components/Deterrent";
import { familyMatch } from "@/lib/faces";

export default function DetectorPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);
  const beatTimer = useRef<number | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const wake = useRef<any>(null);
  const hits = useRef(0);
  const lastSent = useRef(0);
  const busy = useRef(false);
  const cfg = useRef({ from: 22, to: 6, always: true });

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(22);
  const [to, setTo] = useState(6);
  const [always, setAlways] = useState(true);
  const [deter, setDeter] = useState(false);
  const [deterOn, setDeterOn] = useState(true);
  const deterOnRef = useRef(true);

  useEffect(() => { deterOnRef.current = deterOn; }, [deterOn]);
  useEffect(() => { cfg.current = { from, to, always }; }, [from, to, always]);
  useEffect(() => () => stop(), []);

  function inNight() {
    const { from, to, always } = cfg.current;
    if (always) return true;
    const h = new Date().getHours();
    return from > to ? h >= from || h < to : h >= from && h < to;
  }

  async function snapshot(): Promise<string | null> {
    try {
      const v = videoRef.current!;
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.8));
      const name = `${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("snapshots").upload(name, blob, { contentType: "image/jpeg" });
      if (error) return null;
      return supabase.storage.from("snapshots").getPublicUrl(name).data.publicUrl;
    } catch {
      return null;
    }
  }

  function torchStrobe(seconds = 20) {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    let on = false;
    const t = window.setInterval(() => {
      on = !on;
      track.applyConstraints({ advanced: [{ torch: on } as any] }).catch(() => {});
    }, 200);
    window.setTimeout(() => {
      clearInterval(t);
      track.applyConstraints({ advanced: [{ torch: false } as any] }).catch(() => {});
    }, seconds * 1000);
  }

  async function beat() {
    let battery: number | null = null;
    let charging: boolean | null = null;
    try {
      const b = await (navigator as any).getBattery?.();
      if (b) {
        battery = Math.round(b.level * 100);
        charging = b.charging;
      }
    } catch {}
    try {
      await api("/api/device/heartbeat", { method: "POST", body: JSON.stringify({ battery, charging }) });
    } catch {}
  }

  async function trigger() {
    const { data } = await supabase.rpc("get_my_zone");
    if (!data || data.length === 0) {
      setStatus("Pehle dashboard par zone save karein.");
      return;
    }
    const photoUrl = await snapshot();
    try {
      const res = await api<{ notified: number; filtered?: boolean }>("/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          lat: data[0].lat,
          lng: data[0].lng,
          description: "AI camera ne ghar ke bahar insaan detect kiya.",
          source: "camera",
          photoUrl,
        }),
      });
      if (res.filtered) {
        setStatus("🧠 Gemini ne kaha: asli insaan nahi, alert nahi bheja.");
        return;
      }
      setStatus(`🚨 Insaan detect hua! ${res.notified} logon ko alert gaya (${new Date().toLocaleTimeString()}).`);
    } catch (e) {
      setStatus(`Alert error: ${(e as Error).message} (siren local chal rahi hai)`);
    }
  }

  async function start() {
    try {
      setStatus("AI model load ho raha hai (pehli baar 10-20 second)...");
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const coco = await import("@tensorflow-models/coco-ssd");
      const model = await coco.load();

      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      const v = videoRef.current!;
      v.srcObject = s;
      await v.play();

      try { wake.current = await (navigator as any).wakeLock.request("screen"); } catch {}

      setRunning(true);
      setStatus("👁️ Nigrani chal rahi hai...");

      beat();
      beatTimer.current = window.setInterval(beat, 60000);

      timer.current = window.setInterval(async () => {
        if (busy.current) return;
        busy.current = true;
        try {
          if (!inNight()) {
            hits.current = 0;
            return;
          }
          const preds = await model.detect(v);
          const person = preds.some((p) => p.class === "person" && p.score > 0.6);
          hits.current = person ? hits.current + 1 : 0;

          if (hits.current >= 3 && Date.now() - lastSent.current > 120000) {
            const who = await familyMatch(v);
            if (who) {
              hits.current = 0;
              lastSent.current = Date.now() - 100000; // 20 second baad dobara dekhe
              setStatus(`🏠 Ghar ka fard pehchana: ${who}. Alert nahi bheja.`);
              return;
            }
            lastSent.current = Date.now();
            hits.current = 0;
            if (deterOnRef.current) {
              setDeter(true);
              torchStrobe();
            }
            trigger();
          }
        } finally {
          busy.current = false;
        }
      }, 1000);
    } catch (e) {
      setStatus(`Camera/AI error: ${(e as Error).message}`);
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (beatTimer.current) {
      clearInterval(beatTimer.current);
      beatTimer.current = null;
      api("/api/device/disarm", { method: "POST" }).catch(() => {});
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    wake.current?.release?.();
    setRunning(false);
    setStatus("Nigrani band.");
  }

  return (
    <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
      <Deterrent active={deter} onStop={() => setDeter(false)} />

      <h2 className="font-semibold text-blue-700">👁️ AI Camera Detector (raat ke liye)</h2>
      <p className="text-sm text-gray-600">
        Ye page purane phone/laptop par kholen, charger lagayen, camera gate ki taraf rakhen.
      </p>

      <video ref={videoRef} muted playsInline className="w-full rounded-lg bg-black max-h-64" />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={deterOn} onChange={(e) => setDeterOn(e.target.checked)} />
        🔊 Chor ko bhagao mode (siren + strobe + awaaz)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} />
        Hamesha detect karein (testing ke liye)
      </label>

      {!always && (
        <div className="flex items-center gap-2 text-sm">
          Raat ka waqt:
          <input type="number" min={0} max={23} value={from} onChange={(e) => setFrom(+e.target.value)} className="w-16 border rounded px-2 py-1" />
          se
          <input type="number" min={0} max={23} value={to} onChange={(e) => setTo(+e.target.value)} className="w-16 border rounded px-2 py-1" />
          baje tak
        </div>
      )}

      {!running ? (
        <button onClick={start} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2">
          ▶️ Detector start karein
        </button>
      ) : (
        <button onClick={stop} className="w-full bg-gray-700 hover:bg-gray-800 text-white rounded-lg py-2">
          ⏹️ Band karein
        </button>
      )}

      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}