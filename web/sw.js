const SCOPE = new URL("./", self.location.href);
const CACHE_PREFIX = `typerush-app-${encodeURIComponent(SCOPE.pathname)}-`;
const CACHE = `${CACHE_PREFIX}__BUILD_VERSION__`;
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./game.js",
  "./storage.js",
  "./backup.js",
  "./manifest.webmanifest",
  "./assets/words.txt",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // Do not replace the running version mid-round. The app offers an update button.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(SHELL.map((file) => new URL(file, SCOPE).href)),
      ),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Only static app caches are retired. IndexedDB profiles/scores are untouched.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== SCOPE.origin ||
    !url.pathname.startsWith(SCOPE.pathname)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Serve one coherent app version. Navigation queries do not break offline launch.
      const cached =
        request.mode === "navigate"
          ? await cache.match(new URL("./index.html", SCOPE).href)
          : await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      return fetch(request);
    })(),
  );
});
