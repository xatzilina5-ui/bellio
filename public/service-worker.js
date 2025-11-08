self.addEventListener("install", (event) => {
  console.log("Bellio service worker installed.");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Bellio service worker activated.");
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
// ---- Push Notification handler ----
self.addEventListener("push", function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || "/logo.png",
      vibrate: [200, 100, 200],
      sound: "/ding.mp3"
    };
    event.waitUntil(
      self.registration.showNotification(data.title || "Bellio", options)
    );
  }
});
