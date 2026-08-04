import { defineStore } from "pinia";
import { getCart, addToCart, updateCartQuantity, removeFromCart, clearCart } from "../db/cartRepo";
import { notifyStateChanged, onStateChanged } from "../sync/broadcastChannel";
import { useProductsStore } from "./products";
import type { CartItemRecord, ProductRecord } from "../db/schema";

export interface PriceConflict {
  name: string;
  oldPrice: number;
  newPrice: number;
}

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
    // Compares captured item prices (priceAtAdd) against the latest catalog
    // prices in productsStore to surface price drifts before checkout.
    priceConflicts(state): PriceConflict[] {
      const productsStore = useProductsStore();
      return state.items
        .map((item) => {
          const current = productsStore.products.find((p) => p.id === item.productId);
          if (!current || current.price === item.priceAtAdd) return null;
          return { name: item.name, oldPrice: item.priceAtAdd, newPrice: current.price };
        })
        .filter((c): c is PriceConflict => c !== null);
    },
  },
  actions: {
    async initialize() {
      this.loading = true;
      this.items = await getCart();
      this.loading = false;

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
      useProductsStore().adjustLocalStock(product.id, quantity);
    },
    async updateQuantity(productId: string, quantity: number) {
      const previousQuantity = this.items.find((i) => i.productId === productId)?.quantity ?? 0;
      await updateCartQuantity(productId, quantity);
      this.items = await getCart();
      notifyStateChanged({ type: "cart-changed" });
      useProductsStore().adjustLocalStock(productId, quantity - previousQuantity);
    },
    async remove(productId: string) {
      const existing = this.items.find((i) => i.productId === productId);
      await removeFromCart(productId);
      this.items = await getCart();
      notifyStateChanged({ type: "cart-changed" });
      if (existing) useProductsStore().adjustLocalStock(productId, -existing.quantity);
    },
    async clear() {
      await clearCart();
      this.items = await getCart();
      notifyStateChanged({ type: "cart-changed" });
    },
  },
});
