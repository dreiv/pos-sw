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

If a user has the app open in two tabs, each one still writes straight to IndexedDB directly — there's no leader tab and no cross-tab lock for these writes, since IndexedDB writes from both tabs are already safe on their own (the cart and outbox repos use a single atomic `readwrite` transaction per operation, so two tabs racing to update the same record can't lose an update). (The one exception is the outbox _reconciliation_ loop's outgoing network retries, which do elect a leader via the Web Locks API — see the service-worker section below — precisely because a redundant fetch, unlike a redundant IndexedDB write, is real network traffic worth avoiding.) What BroadcastChannel adds on top is just a doorbell: whenever a tab changes the cart, the products catalog, or the outbox, it sends a short message like "cart changed" — not the actual data. Other tabs, on receiving that message, read straight from IndexedDB again. IndexedDB stays the single source of truth at all times; the channel never carries a second copy of the data that could drift out of sync.

The product catalog's "available stock" follows the same idea one level up: it's a derived getter (`product.stock - quantityInCart`) rather than a value pushed into the store, so it stays correct in every tab automatically once the cart's IndexedDB state is re-read — nothing has to remember to update it by hand. (This only accounts for one client's own cart, though — see the "Known limitation" note below.)

### Online/offline detection without a heartbeat

I don't do periodic pings to the server. `navigator.onLine` (via VueUse's `useNetwork()`) gives a cheap first signal — "is a network interface up at all" — and that's upgraded to something more accurate opportunistically: any real request the app makes anyway (a product-catalog refresh, an outbox sync attempt) reports its actual outcome back to a shared `isOnline` signal, since even a 4xx/5xx response proves the network path itself works. The only dedicated network request is a single health check at boot, to get an accurate starting value before any real traffic has happened yet.

### Service worker (Workbox, injectManifest)

The app shell (JS/CSS/HTML) is precached when the service worker installs, so the app can boot with zero network requests from the second visit onward. For assets that don't have a version hash in their URL, I use stale-while-revalidate — serve from cache instantly, but refresh in the background, so I never get stuck on a stale version indefinitely. The most important detail, though: I explicitly exclude `/products` and `/transactions` from Workbox's own caching (`NetworkOnly`). That traffic already has a dedicated offline layer — IndexedDB, with the outbox and price-conflict detection — and I don't want two separate caches that could end up disagreeing with each other.

Retrying failed `/transactions` requests is handled entirely at the app level, not by the service worker — the outbox store's `reconcilePending()` is the only retry path, on every browser. It's driven by two triggers: the browser's `online` event, and `document.visibilitychange` firing with the tab visible. The latter matters because Safari and Firefox don't implement the Background Sync API at all, so a service-worker-driven retry queue would leave those users' pending transactions stuck; checking on tab-foreground instead reaches everyone. To avoid every open tab hammering the server with the same retry at once, both triggers go through a Web Locks API leader election (`navigator.locks.request(..., { ifAvailable: true }, ...)`) first, so only one tab is actively retrying a given round — a tab that doesn't win the lock just skips it, since another trigger is always coming.

A pending record that's been retried for a long time without success (currently 48h) is marked `failed` rather than left `pending` forever, and the checkout screen shows an honest "couldn't be sent automatically — contact a staff member" message for it instead of implying indefinite guaranteed retry.

Either way a transaction succeeds, every open tab picks it up through the same BroadcastChannel doorbell described above: the tab that succeeded notifies "outbox changed," and the others just re-read the record from IndexedDB.

### Known limitation: stock isn't concurrency-safe

`availableStock` (`product.stock - quantityInCart`) is derived purely from this client's own IndexedDB state, and the server never decrements `products.json`'s `stock` on a successful transaction. Two terminals can both see the last unit as available and both check out — accepted for the current scope of this project, not an oversight. Fixing it properly needs different retry semantics than the rest of the outbox (a stock-rejected transaction must _not_ keep retrying the way a transient 503 does), so it's left as an explicit non-goal rather than folded into the money/sync fixes above.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).
