import { createRouter, createWebHistory } from "vue-router";
import ScanView from "@/views/ScanView.vue";
import CartView from "@/views/CartView.vue";
import CheckoutView from "@/views/CheckoutView.vue";
import AdminProductsView from "@/views/AdminProductsView.vue";
import { useCartStore } from "@/stores/cart";
import { useProductsStore } from "@/stores/products";
import { useOutboxStore } from "@/stores/outbox";
import { useConnectivityStore } from "@/stores/connectivity";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/scan" },
    { path: "/scan", name: "scan", component: ScanView },
    { path: "/cart", name: "cart", component: CartView },
    { path: "/checkout", name: "checkout", component: CheckoutView },
    {
      path: "/admin/products",
      name: "admin-products",
      component: AdminProductsView,
    },
  ],
});

let storesInitialized = false;
const PRODUCT_SENSITIVE_ROUTES = new Set(["scan", "cart"]);

// Run initial store hydrations (IndexedDB loads, network listener bindings)
// once on app bootstrap rather than re-triggering on every route transition.
router.beforeEach(async (to) => {
  if (!storesInitialized) {
    storesInitialized = true;

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

    return true;
  }

  if (typeof to.name === "string" && PRODUCT_SENSITIVE_ROUTES.has(to.name)) {
    const productsStore = useProductsStore();
    if (productsStore.isDirty) {
      await productsStore.refresh();
    }
  }

  return true;
});

export default router;
