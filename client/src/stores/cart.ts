import { defineStore } from "pinia";
import { getCart, addToCart, updateCartQuantity, removeFromCart, clearCart } from "../db/cartRepo";
import { notifyStateChanged, onStateChanged } from "../sync/broadcastChannel";
import type { CartItemRecord, ProductRecord } from "../db/schema";

export const useCartStore = defineStore("cart", {
  state: () => ({
    items: [] as CartItemRecord[],
    loading: false,
    unsubscribeBroadcast: null as (() => void) | null,
  }),
  getters: {
    total: (state): number =>
      state.items.reduce((sum, item) => sum + item.priceAtAdd * item.quantity, 0),
    itemCount: (state): number => state.items.reduce((sum, item) => sum + item.quantity, 0),
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.items = await getCart();
      this.loading = false;

      // Ne abonăm o singură dată per instanță de store — initialize()
      // rulează la fiecare mount de view, dar vrem un singur listener
      // care re-citește la broadcast, nu unul per view vizitat.
      if (!this.unsubscribeBroadcast) {
        this.unsubscribeBroadcast = onStateChanged((message) => {
          if (message.type === "cart-changed") {
            // Alt tab a schimbat coșul. IndexedDB e deja sursa de
            // adevăr (s-a scris acolo înainte de broadcast) — noi doar
            // aliniem copia din memorie a acestui tab.
            getCart().then((items) => {
              this.items = items;
            });
          }
        });
      }
    },
    async add(product: ProductRecord, quantity = 1) {
      await addToCart(product, quantity);
      this.items = await getCart();
      notifyStateChanged({ type: "cart-changed" });
    },
    async updateQuantity(productId: string, quantity: number) {
      await updateCartQuantity(productId, quantity);
      this.items = await getCart();
      notifyStateChanged({ type: "cart-changed" });
    },
    async remove(productId: string) {
      await removeFromCart(productId);
      this.items = await getCart();
      notifyStateChanged({ type: "cart-changed" });
    },
    async clear() {
      await clearCart();
      this.items = await getCart();
      notifyStateChanged({ type: "cart-changed" });
    },
  },
});
