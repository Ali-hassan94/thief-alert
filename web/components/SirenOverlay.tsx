"use client";

import { useEffect, useRef, useState } from "react";

export default function SirenOverlay({ onClose }: { onClose: () => void }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const [blocked, setBlocked] = useState(false);

  function startSiren() {
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      gain.gain.value = 0.8;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      // Awaaz upar neeche (police siren jaisi)
      let high = false;
      const t = setInterval(() => {
        high = !high;
        osc.frequency.setTargetAtTime(high ? 1200 : 700, ctx.currentTime, 0.05);
      }, 450);
      (ctx as any)._t = t;

      ctx.resume().then(() => setBlocked(ctx.state !== "running"));
      if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
    } catch {
      setBlocked(true);
    }
  }

  function stopSiren() {
    const ctx = ctxRef.current;
    if (ctx) {
      clearInterval((ctx as any)._t);
      ctx.close();
    }
    if (navigator.vibrate) navigator.vibrate(0);
  }

  useEffect(() => {
    startSiren();
    return stopSiren;
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-red-600 animate-pulse text-white p-6 text-center">
      <div className="text-7xl mb-4">🚨</div>
      <h1 className="text-3xl font-bold mb-2">CHOR ALERT!</h1>
      <p className="mb-6">Aap ke ilaqe me mushtabah insaan dekha gaya hai.</p>

      {blocked && (
        <button
          onClick={() => { stopSiren(); startSiren(); }}
          className="mb-4 bg-white text-red-700 font-bold rounded-lg px-6 py-3"
        >
          🔊 Siren bajayen
        </button>
      )}

      <button
        onClick={() => { stopSiren(); onClose(); }}
        className="bg-black/70 hover:bg-black text-white font-semibold rounded-lg px-6 py-3"
      >
        ⏹️ Siren band karein
      </button>
    </div>
  );
}