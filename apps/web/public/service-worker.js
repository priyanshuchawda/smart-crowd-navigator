const SHELL_CACHE = "crowdnav-shell-v2";
const STATIC_CACHE = "crowdnav-static-v2";
const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

async function getPrecacheAssets() {
  const response = await fetch("/", { cache: "no-cache" });
  const html = await response.text();
  const assetMatches = [
    ...html.matchAll(
      /(?:href|src)="(\/(?:assets\/[^"]+|manifest\.json|favicon\.svg|icon-\d+\.png|apple-touch-icon\.png))"/g,
    ),
  ].map((match) => match[1]);

  return [...new Set([...SHELL_ASSETS, ...assetMatches])];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.add("/")),
      getPrecacheAssets().then((assets) =>
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(assets)),
      ),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedResponse = await caches.match("/");
        return cachedResponse ?? Response.error();
      }),
    );
    return;
  }

  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png" ||
    url.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const networkResponsePromise = fetch(request)
          .then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => cachedResponse ?? Response.error());

        return cachedResponse ?? networkResponsePromise;
      }),
    );
  }
});
