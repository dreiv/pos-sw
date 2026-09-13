/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// App shell precache, injected at build time by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

// Runtime caching for assets not covered by the precache manifest (e.g. CDN fonts).
registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image",
  new StaleWhileRevalidate({
    cacheName: "runtime-static-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  }),
);

// Not caching /products here — IndexedDB (src/db) is already the offline data layer.
registerRoute(({ url }) => url.pathname.startsWith("/products"), new NetworkOnly());

registerRoute(
  ({ url, request }) => url.pathname.startsWith("/transactions") && request.method === "POST",
  new NetworkOnly(),
  "POST",
);

// SKIP_WAITING: applies a waiting update (triggered by App.vue's update button).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
