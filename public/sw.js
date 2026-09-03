/* Tempo service worker — offline shell caching. No network calls leave the
   device for app data; this only caches the app's own static files. */
const CACHE = "tempo-cache-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  /* Navigations: network first (fresh app), cache fallback (offline). */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then((hit) => hit || caches.match("./"))),
    );
    return;
  }

  /* Static assets & fonts: cache first, fill in the background. */
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit),
    ),
  );
});
