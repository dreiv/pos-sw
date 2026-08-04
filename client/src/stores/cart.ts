import { defineStore } from "pinia";
import {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
} from "../db/cartRepo";
import type { CartItemRecord, ProductRecord } from "../db/schema";

export const useCartStore = defineStore("cart", {
  state: () => ({
    items: [] as CartItemRecord[],
    loading: false,
  }),
  getters: {
    total: (state): number =>
      state.items.reduce((sum, item) => sum + item.priceAtAdd * item.quantity, 0),
    itemCount: (state): number =>
      state.items.reduce((sum, item) => sum + item.quantity, 0),
  },
  actions: {
    // Same pattern as the products store: every mutation writes to
    // IndexedDB first, then re-reads the whole cart back into state.
    // A bit more I/O than mutating state directly, but it means state
    // can never drift from what's actually persisted — important here
    // since a crash/refresh mid-transaction has to recover from the DB,
    // not from in-memory state that just got wiped.
    async initialize() {
      this.loading = true;
      this.items = await getCart();
      this.loading = false;
    },
    async add(product: ProductRecord, quantity = 1) {
      await addToCart(product, quantity);
      this.items = await getCart();
    },
    async updateQuantity(productId: string, quantity: number) {
      await updateCartQuantity(productId, quantity);
      this.items = await getCart();
    },
    async remove(productId: string) {
      await removeFromCart(productId);
      this.items = await getCart();
    },
    async clear() {
      await clearCart();
      this.items = await getCart();
    },
  },
});
