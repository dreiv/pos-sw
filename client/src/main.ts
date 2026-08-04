import "./styles/main.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { useCartStore } from "./stores/cart";
import { useProductsStore } from "./stores/products";
import { useOutboxStore } from "./stores/outbox";
import { useConnectivityStore } from "./stores/connectivity";

// Data-layer bootstrap: open IndexedDB and hydrate the Pinia stores
// once here, before the app mounts, instead of via a router.beforeEach
// guard. Keeps the router a pure routing concern and startup order
// explicit; wrap this in a splash screen or swap for <Suspense> in
// App.vue if the async setup ever needs a loading UI.
async function bootstrap() {
  const app = createApp(App);
  app.use(createPinia());

  const cartStore = useCartStore();
  const productsStore = useProductsStore();
  const outboxStore = useOutboxStore();
  const connectivityStore = useConnectivityStore();

  await Promise.all([
    cartStore.initialize(),
    productsStore.initialize(),
    outboxStore.initialize(),
  ]);
  connectivityStore.initialize();

  app.use(router);
  app.mount("#app");
}

bootstrap();
