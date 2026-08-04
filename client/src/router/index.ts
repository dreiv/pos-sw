import { createRouter, createWebHistory } from "vue-router";
import ScanView from "@/views/ScanView.vue";
import CartView from "@/views/CartView.vue";
import CheckoutView from "@/views/CheckoutView.vue";
import AdminProductsView from "@/views/AdminProductsView.vue";

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

export default router;