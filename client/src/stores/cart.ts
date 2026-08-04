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

      // Subscribe once per store instance — initialize() runs on every
      // view mount (ScanView, CartView, CheckoutView all call it), but
      // we only want one listener re-reading on broadcast, not one per
      // view visited.
      if (!this.unsubscribeBroadcast) {
        this.unsubscribeBroadcast = onStateChanged((message) => {
          if (message.type === "cart-changed") {
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
