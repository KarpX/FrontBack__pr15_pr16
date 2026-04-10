const SHELL_CACHE = "pwa-shell-v1";
const RUNTIME_CACHE = "pwa-runtime-v1";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/assets/hero.png",
  "/assets/icons/favicon.ico",
  "/assets/icons/favicon-16x16.png",
  "/assets/icons/favicon-32x32.png",
  "/assets/icons/favicon-48x48.png",
  "/assets/icons/favicon-64x64.png",
  "/assets/icons/favicon-128x128.png",
  "/assets/icons/favicon-256x256.png",
  "/assets/icons/favicon-512x512.png",
  "/assets/icons/apple-touch-icon.png",
];

const CONTENT_PAGES = [
  "/content/home.html",
  "/content/theory.html",
  "/content/push.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ASSETS);

      await cache.addAll(CONTENT_PAGES);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      );
      self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/content/")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, res);
    return res;
  } catch {
    return new Response("Офлайн: ресурс недоступен и не найден в кеше.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    const shellCached = await caches.match(request);
    if (shellCached) return shellCached;

    return new Response("Офлайн: контент недоступен и не найден в кеше.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("push", (event) => {
  const data = event.data ? safeJson(event.data.text()) : {};
  const title = data.title || "PWA уведомление";
  const options = {
    body: data.body || "У вас новое событие.",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if (client.url.includes(url) && "focus" in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })(),
  );
});

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
