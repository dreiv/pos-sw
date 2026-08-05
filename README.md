# POS Self-Checkout — client

Offline-first self-checkout app, built with Vue 3 + Vite + Pinia + IndexedDB, as an interview-prep practice project.

## Setup

```sh
npm install
npm run dev
```

The fake backend (with a simulated 30% failure rate) runs separately, from `../server`.

## Structure

```
src/
  config.ts — single source of truth for the API base URL
  db/       — IndexedDB (idb): products (cache), cart, outbox
  stores/   — Pinia: cart, products, outbox, connectivity
  styles/   — global CSS: design tokens + dark mode (prefers-color-scheme)
  sync/     — broadcast (cross-tab signal) + connectivity (online/offline)
  sw/       — service worker (Workbox, injectManifest)
  utils/    — shared helpers (e.g. price formatting)
  views/    — ScanView, CartView, CheckoutView, AdminProductsView
```

### Outbox pattern

A checkout never starts with a `fetch` to the server. The first thing that happens is writing a record to IndexedDB, with status `pending` and a client-generated UUID. Only after that local write does the app try to send it. The reason: if I sent straight to the server and the request failed (offline, server down), the transaction wouldn't exist anywhere — the client would just lose it. By writing it locally first, the transaction is durable the moment the customer confirms, regardless of network. The server becomes an eventual destination, not a synchronous dependency for not losing data.

### Idempotency

The UUID generated at creation time is sent every time — on the first attempt, and on every retry. The server uses it as a key: if it's already seen that id, it returns the response it already recorded, instead of processing the request again. This matters because a retry doesn't only happen when the client is sure the first attempt failed — it also happens when the client simply doesn't know what happened (the request went out, but the response never came back). Without idempotency, that retry would mean double-processing the transaction. With it, a retry is always safe — even if the server did in fact process it the first time. It's also what makes it safe to have more than one recovery path racing to resend the same pending record (see below) — worst case is a redundant request, not a duplicate charge.

### Multi-tab coordination (BroadcastChannel)

If a user has the app open in two tabs, each one still writes straight to IndexedDB directly — there's no leader tab and no cross-tab lock, since IndexedDB writes from both tabs are already safe on their own (the cart and outbox repos use a single atomic `readwrite` transaction per operation, so two tabs racing to update the same record can't lose an update). What BroadcastChannel adds on top is just a doorbell: whenever a tab changes the cart, the products catalog, or the outbox, it sends a short message like "cart changed" — not the actual data. Other tabs, on receiving that message, read straight from IndexedDB again. IndexedDB stays the single source of truth at all times; the channel never carries a second copy of the data that could drift out of sync.

The product catalog's "available stock" follows the same idea one level up: it's a derived getter (`product.stock - quantityInCart`) rather than a value pushed into the store, so it stays correct in every tab automatically once the cart's IndexedDB state is re-read — nothing has to remember to update it by hand.

### Online/offline detection without a heartbeat

I don't do periodic pings to the server. `navigator.onLine` (via VueUse's `useNetwork()`) gives a cheap first signal — "is a network interface up at all" — and that's upgraded to something more accurate opportunistically: any real request the app makes anyway (a product-catalog refresh, an outbox sync attempt) reports its actual outcome back to a shared `isOnline` signal, since even a 4xx/5xx response proves the network path itself works. The only dedicated network request is a single health check at boot, to get an accurate starting value before any real traffic has happened yet.

### Service worker (Workbox, injectManifest) + active sync

The app shell (JS/CSS/HTML) is precached when the service worker installs, so the app can boot with zero network requests from the second visit onward. For assets that don't have a version hash in their URL, I use stale-while-revalidate — serve from cache instantly, but refresh in the background, so I never get stuck on a stale version indefinitely. The most important detail, though: I explicitly exclude `/products` and `/transactions` from Workbox's own caching (`NetworkOnly`). That traffic already has a dedicated offline layer — IndexedDB, with the outbox and price-conflict detection — and I don't want two separate caches that could end up disagreeing with each other.

Failed `/transactions` requests are queued via Workbox's Background Sync (a Workbox `Queue`, backed by its own separate IndexedDB database from the app's own). The browser's native `sync` event will eventually retry that queue on its own schedule — but that schedule is opaque and can lag well behind the connection actually coming back, which used to leave the UI stuck showing "pending" until a manual refresh. To fix that, the outbox store listens for the browser's `online` event and does two things immediately: sends the service worker a `postMessage({ type: "FORCE_SYNC" })` to replay the queue right away, and also calls its own `reconcilePending()` from the main thread as a fallback for the case where no service worker is controlling the page yet. Either path, once a request actually succeeds, notifies every open tab via `postMessage`/BroadcastChannel so the pending record flips to synced everywhere, not just in the tab that happened to be leading the retry.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).
