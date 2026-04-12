// Villa Carmen Backoffice - Service Worker
// Caches static assets for offline use and provides network-first API strategy.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `vc-static-${CACHE_VERSION}`;
const API_CACHE = `vc-api-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  "/",
  "/offline",
];

// ---------------------------------------------------------------------------
// Install: precache critical assets
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// Activate: clear old caches
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("vc-") && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch: hybrid caching strategy
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from our origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // API responses: network-first, fallback to cache
  if (url.pathname.startsWith("/api/admin")) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // HTML pages: stale-while-revalidate
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
});

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ success: false, message: "Sin conexion y sin datos en cache" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cached || (await fetchPromise) || caches.match(OFFLINE_URL);
}

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();

  const options = {
    body: data.body ?? "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.tag ?? "vc-notification",
    data: { url: data.url ?? "/" },
    vibrate: [100, 50, 100],
    requireInteraction: data.urgent ?? false,
    actions: (data.actions ?? []).map((action) => ({
      action: action.action,
      title: action.title,
    })),
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Villa Carmen", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing window if open, otherwise open new one
      for (const client of clients) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
