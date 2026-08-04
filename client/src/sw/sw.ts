/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

/**
 * App shell precache. `self.__WB_MANIFEST` is injected at build time
 * by vite-plugin-pwa (injectManifest strategy) with the list of every
 * build asset (JS/CSS/HTML/icons) matching globPatterns in
 * vite.config.ts. Precaching means all of that is downloaded and
 * saved to Cache Storage right when the SW installs — so the app can
 * boot with zero network requests from the second visit onward.
 * That's literally the definition of "offline-first" for the shell.
 */
precacheAndRoute(self.__WB_MANIFEST);

// Clear out caches from older SW versions on every activation, so old
// build hashes don't accumulate forever.
cleanupOutdatedCaches();

/**
 * Runtime caching for anything NOT covered by the precache manifest —
 * e.g. fonts from an external CDN, or any static asset that shows up
 * without a content hash in its URL.
 *
 * Strategy: stale-while-revalidate.
 *
 * Why this and not cache-first: build assets ARE already cache-first
 * de facto (their filename contains a content hash, so "keep in cache
 * forever, a new deploy means a new URL" is safe and correct — see
 * precacheAndRoute above). Anything hitting this route, by
 * definition, does NOT have a hash-versioned URL — so we can't
 * guarantee a stale cache-first response is still valid; we could get
 * stuck with an old icon or font indefinitely. Stale-while-revalidate
 * serves the cached copy instantly (fast, works offline) AND kicks
 * off a background fetch to refresh it for next time — the right fit
 * for "static, but not versioned by hash".
 */
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

/**
 * Deliberately NOT caching /products or /transactions through the
 * service worker (NetworkOnly = let the request go straight to the
 * network or fail naturally, without touching Cache Storage).
 *
 * This app already has a dedicated offline data layer for exactly
 * this traffic: IndexedDB (product cache + outbox pattern) in src/db
 * and src/sync. That layer knows about idempotency keys, conflict
 * detection (price changed while the product sat in the cart), and
 * sync status — a generic HTTP cache from the service worker knows
 * none of that. If Workbox also cached these responses, we'd end up
 * with two concurrent offline copies of the same data that could
 * disagree with each other — and a stale SW-cached product catalog
 * could silently mask the price-conflict UI the app is supposed to
 * show. One offline strategy per data type, not a second one
 * accidentally layered on top of the first.
 */
registerRoute(
  ({ url }) => url.pathname.startsWith("/products") || url.pathname.startsWith("/transactions"),
  new NetworkOnly(),
);

// registerType: "prompt" (see vite.config.ts) means we show the user
// an "update available" prompt instead of silently activating a new
// SW version mid-session (which could serve a new app shell while the
// old JS, already loaded in memory, is still running against it).
// This listener is the mechanism through which the UI's "update"
// button (see App.vue) actually applies the update: SKIP_WAITING
// moves the new SW from "waiting" to "active" only after the user has
// explicitly agreed.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});