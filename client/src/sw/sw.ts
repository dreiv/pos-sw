/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import type { WorkboxPlugin } from "workbox-core/types";

// App shell precache. `self.__WB_MANIFEST` is injected at build time
// by vite-plugin-pwa with the list of build assets matching
// globPatterns in vite.config.ts, so the app boots offline from the
// second visit onward.
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

// Runtime caching for assets not covered by the precache manifest
// (e.g. CDN fonts) — anything without a content-hashed URL, so
// stale-while-revalidate instead of cache-first.
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

// Deliberately NOT caching /products through the service worker —
// IndexedDB (src/db) is already the offline data layer for the
// catalog, including price-conflict detection. A second SW-level
// cache would create two offline copies that could disagree.
registerRoute(({ url }) => url.pathname.startsWith("/products"), new NetworkOnly());

// Workbox only invokes `fetchDidFail` when `fetch()` itself throws
// (offline, DNS, connection reset) — a resolved 503 is still a
// "success" as far as fetch() is concerned. Throwing from
// `fetchDidSucceed` routes a non-2xx /transactions response into the
// same failure path, so it's picked up by the Background Sync queue too.
const throwOnBadStatus: WorkboxPlugin = {
  fetchDidSucceed: async ({ response }) => {
    if (!response.ok) {
      throw new Error(`/transactions responded ${response.status}`);
    }
    return response;
  },
};

// Background Sync queue for offline checkouts — the browser retries a
// queued request once connectivity returns, including while the app
// isn't open, so no more manual polling loop.
//
// `onSync` overrides the plugin's default silent replay: we need to
// tell the page which outbox record got confirmed so it can flip that
// record's status to "synced" in IndexedDB (only the page owns that write).
const bgSyncPlugin = new BackgroundSyncPlugin("transactions-outbox-queue", {
  maxRetentionTime: 24 * 60, // give up after 24h
  onSync: async ({ queue }) => {
    let entry = await queue.shiftRequest();
    while (entry) {
      try {
        const response = await fetch(entry.request.clone());
        if (!response.ok) {
          throw new Error(`/transactions responded ${response.status}`);
        }

        const { id } = (await entry.request.clone().json()) as { id: string };
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: "OUTBOX_SYNCED", id });
        }
      } catch (error) {
        // Put it back at the front and stop, preserving delivery order.
        await queue.unshiftRequest(entry);
        throw error;
      }
      entry = await queue.shiftRequest();
    }
  },
});

registerRoute(
  ({ url, request }) => url.pathname.startsWith("/transactions") && request.method === "POST",
  new NetworkOnly({ plugins: [throwOnBadStatus, bgSyncPlugin] }),
  "POST",
);

// SKIP_WAITING moves the new SW from "waiting" to "active" only after
// the user explicitly agrees (triggered by App.vue's update button).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
