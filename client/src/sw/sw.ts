/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

/**
 * App shell precache. `self.__WB_MANIFEST` e injectat la build de
 * vite-plugin-pwa (strategia injectManifest) cu lista fiecărui asset
 * din build (JS/CSS/HTML/iconițe) care se potrivește cu globPatterns
 * din vite.config.ts. Precaching înseamnă că toate astea se descarcă
 * și se salvează în Cache Storage chiar la instalarea SW-ului — deci
 * aplicația poate porni cu zero request-uri de rețea din a doua
 * vizită încolo. Asta e, literal, definiția "offline-first" pentru
 * shell.
 */
precacheAndRoute(self.__WB_MANIFEST);

// Curăță cache-urile din versiuni vechi de SW la fiecare activare, ca
// să nu se acumuleze la infinit hash-uri de build vechi.
cleanupOutdatedCaches();

/**
 * Runtime caching pentru orice NU e acoperit de manifest-ul de
 * precache — de exemplu fonturi de pe un CDN extern, sau orice asset
 * static apărut fără hash de conținut în URL.
 *
 * Strategie: stale-while-revalidate.
 *
 * De ce asta și nu cache-first: assets din build SUNT deja cache-first
 * de facto (numele lor conține un hash de conținut, deci "ținut în
 * cache la nesfârșit, un deploy nou = URL nou" e sigur și corect —
 * vezi precacheAndRoute mai sus). Orice ajunge la ruta asta, prin
 * definiție, NU are URL versionat cu hash — deci nu putem garanta că
 * un răspuns cache-first vechi mai e valid; am putea rămâne blocați cu
 * o iconiță sau un font vechi la nesfârșit. Stale-while-revalidate
 * servește instant copia din cache (rapid, merge offline) ȘI pornește
 * un fetch în fundal ca s-o reîmprospăteze pentru data viitoare —
 * potrivirea corectă pentru "static, dar fără versionare prin hash".
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
 * Deliberat NU cache-uim /products sau /transactions prin service
 * worker (NetworkOnly = lasă request-ul să meargă direct la rețea sau
 * să eșueze natural, fără să atingă Cache Storage).
 *
 * Aplicația asta are deja un layer de date offline dedicat exact
 * pentru acest trafic: IndexedDB (cache de produse + outbox pattern)
 * în src/db și src/sync. Layer-ul ăla știe despre chei de idempotență,
 * detectare de conflict (preț schimbat cât timp produsul era în coș)
 * și status de sincronizare — un cache HTTP generic din service
 * worker nu știe nimic din toate astea. Dacă Workbox ar cache-ui ȘI
 * el aceste răspunsuri, am avea două copii offline concurente ale
 * acelorași date, care ar putea să nu fie de acord una cu alta — iar
 * un catalog de produse cache-uit de SW, dar învechit, ar putea masca
 * silent UI-ul de conflict de preț pe care aplicația trebuie să-l
 * arate. O singură strategie offline per tip de date, nu una a doua
 * lipită accidental peste prima.
 */
registerRoute(
  ({ url }) => url.pathname.startsWith("/products") || url.pathname.startsWith("/transactions"),
  new NetworkOnly(),
);

// registerType: "prompt" (vite.config.ts) înseamnă că îi arătăm
// userului un prompt de "update disponibil" în loc să activăm silent
// o versiune nouă de SW în mijlocul unei sesiuni (ceea ce ar putea
// servi un app shell nou în timp ce JS-ul vechi, deja încărcat în
// memorie, încă rulează împotriva lui). Listener-ul ăsta e mecanismul
// prin care butonul de "actualizează" din UI (vezi App.vue) chiar
// aplică update-ul: SKIP_WAITING mută noul SW din starea "waiting" în
// "active" doar după ce userul a fost de acord explicit.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
