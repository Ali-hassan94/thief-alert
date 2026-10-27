// web/components/NotificationButton.tsx
"use client";

import { useEffect, useState } from "react";
import {
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  showLocalTestNotification,
} from "@/lib/push";

export default function NotificationButton() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!pushSupported()) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setEnabled(!!sub && Notification.permission === "granted");
    });
  }, []);

  async function enable() {
    setBusy(true);
    const res = await subscribeToPush();
    setEnabled(res.ok);
    setMessage(res.message);
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    await unsubscribeFromPush();
    setEnabled(false);
    setMessage("Notifications band kar di gayi.");
    setBusy(false);
  }

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <h2 className="font-semibold">🔔 Alert Notifications</h2>
      <p className="text-gray-500 text-sm">
        Notifications on karein taake website band hone par bhi alert mile.
      </p>

      <div className="flex flex-wrap gap-2">
        {!enabled ? (
          <button
            onClick={enable}
            disabled={busy}
            className="bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {busy ? "Intezar..." : "🔔 Notifications on karein"}
          </button>
        ) : (
          <>
            <button
              onClick={showLocalTestNotification}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg px-4 py-2"
            >
              🧪 Test notification
            </button>
            <button
              onClick={disable}
              disabled={busy}
              className="bg-gray-200 hover:bg-gray-300 text-sm rounded-lg px-4 py-2"
            >
              Band karein
            </button>
          </>
        )}
      </div>

      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}