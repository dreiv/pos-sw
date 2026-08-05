/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { Queue } from "workbox-background-sync";
import type { WorkboxPlugin } from "workbox-core/types";

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

// A resolved non-2xx response doesn't throw on its own; this routes it into the
// same failure path as a network error so it also lands in the outbox queue.
const throwOnBadStatus: WorkboxPlugin = {
  fetchDidSucceed: async ({ response }) => {
    if (!response.ok) {
      throw new Error(`/transactions responded ${response.status}`);
    }
    return response;
  },
};

// Notifies the page which record synced (so it can flip status in IndexedDB)
// and preserves delivery order on failure. Shared by the native 'sync' event
// and the FORCE_SYNC message handler below.
async function replayOutboxQueue(queue: Queue): Promise<void> {
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
      await queue.unshiftRequest(entry);
      throw error;
    }
    entry = await queue.shiftRequest();
  }
}

// Built as a standalone Queue (rather than via BackgroundSyncPlugin) so we
// have a public handle to pass into replayOutboxQueue from FORCE_SYNC too —
// BackgroundSyncPlugin keeps its Queue private.
const outboxQueue = new Queue("transactions-outbox-queue", {
  maxRetentionTime: 24 * 60, // give up after 24h
  onSync: async ({ queue }) => {
    await replayOutboxQueue(queue);
  },
});

const outboxQueuePlugin: WorkboxPlugin = {
  fetchDidFail: async ({ request }) => {
    await outboxQueue.pushRequest({ request });
  },
};

registerRoute(
  ({ url, request }) => url.pathname.startsWith("/transactions") && request.method === "POST",
  new NetworkOnly({ plugins: [throwOnBadStatus, outboxQueuePlugin] }),
  "POST",
);

// SKIP_WAITING: applies a waiting update (triggered by App.vue's update button).
// FORCE_SYNC: sent by the outbox store on 'online', since native Background
// Sync can lag well behind the connection actually returning.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "FORCE_SYNC") {
    event.waitUntil(replayOutboxQueue(outboxQueue));
  }
});
