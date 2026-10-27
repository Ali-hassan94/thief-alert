"use client";

import { useEffect, useRef } from "react";

export default function Deterrent({ active, onStop }: { active: boolean; onStop: () => void }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timers = useRef<number[]>([]);
  const stopRef = useRef(onStop);
  stopRef.current = onStop;

  useEffect(() => {
    if (!active) return;

    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      gain.gain.value = 1;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      let high = false;
      timers.current.push(
        window.setInterval(() => {
          high = !high;
          osc.frequency.setTargetAtTime(high ? 1300 : 650, ctx.currentTime, 0.05);
        }, 400)
      );
    } catch {}

    const speak = () => {
      try {
        const u = new SpeechSynthesisUtterance(
          "Warning! You are being recorded. Police has been informed. Leave this place immediately."
        );
        u.lang = "en-US";
        u.rate = 0.9;
        u.volume = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch {}
    };
    speak();
    timers.current.push(window.setInterval(speak, 8000));

    if (navigator.vibrate) navigator.vibrate([800, 300, 800, 300, 800]);

    timers.current.push(window.setTimeout(() => stopRef.current(), 60000));

    return () => {
      timers.current.forEach((t) => {
        clearInterval(t);
        clearTimeout(t);
      });
      timers.current = [];
      ctxRef.current?.close();
      window.speechSynthesis?.cancel();
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-white text-center p-6 strobe">
      <div className="text-8xl mb-4">🚨</div>
      <h1 className="text-4xl font-extrabold mb-2">WARNING!</h1>
      <p className="text-xl mb-1">Aap record ho rahe hain.</p>
      <p className="text-xl mb-8">Police ko inform kar diya gaya hai.</p>
      <button onClick={onStop} className="bg-black/80 text-white rounded-lg px-6 py-3 font-semibold">
        ⏹️ Siren band karein (ghar wale)
      </button>
      <style>{`
        .strobe { animation: strobe 0.4s steps(1) infinite; }
        @keyframes strobe { 0%{background:#dc2626} 50%{background:#1d4ed8} 100%{background:#dc2626} }
      `}</style>
    </div>
  );
}