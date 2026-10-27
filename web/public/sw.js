// web/public/sw.js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Push aane par notification dikhao
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "🚨 Thief Alert", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "🚨 Thief Alert";
  const options = {
    image: data.image || undefined,
    body: data.body || "Aap ke ilaqe me alert aaya hai!",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [500, 200, 500, 200, 500],
    requireInteraction: true, // jab tak user dekhe nahi, notification rahe
    tag: data.tag || "thief-alert",
    renotify: true,
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification par click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});