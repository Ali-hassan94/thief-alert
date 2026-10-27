"use client";

import { useState } from "react";

export default function EmergencyBar() {
  const [msg, setMsg] = useState("");

  function shareWhatsApp() {
    setMsg("Location dhoondi ja rahi hai...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const link = `https://www.google.com/maps?q=${p.coords.latitude},${p.coords.longitude}`;
        const text = encodeURIComponent(`🚨 Madad chahiye! Mere ghar ke qareeb chor. Meri location: ${link}`);
        window.open(`https://wa.me/?text=${text}`, "_blank");
        setMsg("");
      },
      () => setMsg("Location nahi mili. Permission allow karein."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="border-2 border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
      <h2 className="font-semibold text-orange-700">🆘 Emergency</h2>
      <div className="grid grid-cols-2 gap-2">
        <a href="tel:15" className="text-center bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-3">
          📞 Police 15
        </a>
        <a href="tel:1122" className="text-center bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg py-3">
          🚑 Rescue 1122
        </a>
      </div>
      <button onClick={shareWhatsApp} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 text-sm">
        💬 Location WhatsApp par bhejein
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}