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
  db/       — IndexedDB (idb): products (cache), cart, outbox
  stores/   — Pinia: cart, products, outbox, connectivity
  sync/     — outbox → server: sync engine, leader election, broadcast, connectivity
  sw/       — service worker (Workbox, injectManifest)
  views/    — ScanView, CartView, CheckoutView, AdminProductsView
```

### Outbox pattern

A checkout never starts with a `fetch` to the server. The first thing that happens is writing a record to IndexedDB, with status `pending` and a client-generated UUID. Only after that local write does the app try to send it. The reason: if I sent straight to the server and the request failed (offline, server down), the transaction wouldn't exist anywhere — the client would just lose it. By writing it locally first, the transaction is durable the moment the customer confirms, regardless of network. The server becomes an eventual destination, not a synchronous dependency for not losing data.

### Idempotency

The UUID generated at creation time is sent every time — on the first attempt, and on every retry. The server uses it as a key: if it's already seen that id, it returns the response it already recorded, instead of processing the request again. This matters because a retry doesn't only happen when the client is sure the first attempt failed — it also happens when the client simply doesn't know what happened (the request went out, but the response never came back). Without idempotency, that retry would mean double-processing the transaction. With it, a retry is always safe — even if the server did in fact process it the first time.

### Multi-tab coordination (Navigator Locks + BroadcastChannel)

If a user has the app open in two tabs, I don't want each tab running its own sync loop — that would double every request to the server. I solve this with `navigator.locks.request()`: every tab requests a lock with the same name; the browser hands it to exactly one tab, and the other tab's sync code just sits blocked, waiting, with no polling involved. If the leader tab closes, the browser releases the lock automatically and the next tab takes over — I don't have to write any heartbeat or expiry logic myself.

Separately, whenever a tab changes the cart or the outbox, it writes to IndexedDB and then sends a short message over `BroadcastChannel` — not the actual data, just a signal like "something changed in the cart, go re-read it." Other tabs, on receiving that message, read straight from IndexedDB again. IndexedDB stays the single source of truth at all times; the channel is just a doorbell saying "check again," not a second place where a different version of the data could exist.

### Online/offline detection without a heartbeat

I don't do fixed periodic pings to the server — at a scale of thousands of clients, that cost adds up fast. Instead, any real request the app makes anyway (an outbox sync attempt, a product-catalog refresh) reports its outcome to a central connectivity module — so under normal conditions (online), there's no extra request at all. Only if a request fails and the app believes it's offline does it start a recovery probe with exponential backoff and jitter, and only from the leader tab — and it stops as soon as a real request confirms we're back online.

### Service worker (Workbox, injectManifest)

The app shell (JS/CSS/HTML) is precached when the service worker installs, so the app can boot with zero network requests from the second visit onward. For assets that don't have a version hash in their URL, I use stale-while-revalidate — serve from cache instantly, but refresh in the background, so I never get stuck on a stale version indefinitely. The most important detail, though: I explicitly exclude `/products` and `/transactions` from Workbox caching (`NetworkOnly`). That traffic already has a dedicated offline layer — IndexedDB, with the outbox and price-conflict detection — and I don't want two separate caches that could end up disagreeing with each other.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).
