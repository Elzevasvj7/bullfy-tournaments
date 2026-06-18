// Push notification handler for service worker
// This file is imported by the PWA service worker

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Bullfy IB System", body: event.data.text() };
  }

  const options = {
    body: payload.body || payload.message || "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [200, 100, 200],
    tag: payload.tag || "bullfy-notification",
    renotify: true,
    data: {
      url: payload.url || "/",
      notificationId: payload.notificationId,
    },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Bullfy IB System", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
