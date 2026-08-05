import { defineStore } from "pinia";
import { getAllProducts, refreshProductsFromServer } from "../db/productsRepo";
import { onStateChanged } from "../sync/broadcastChannel";
import { useCartStore } from "./cart";
import type { ProductRecord } from "../db/schema";

export const useProductsStore = defineStore("products", {
  state: () => ({
    products: [] as ProductRecord[],
    loading: false,
    lastSyncSucceeded: null as boolean | null,
    isDirty: false,
  }),
  getters: {
    availableStock: (state) => {
      return (productId: string): number => {
        const product = state.products.find((p) => p.id === productId);
        if (!product) return 0;
        const cartStore = useCartStore();
        return Math.max(0, product.stock - cartStore.quantityInCart(productId));
      };
    },
  },
  actions: {
    async refresh() {
      this.lastSyncSucceeded = await refreshProductsFromServer();
      this.products = await getAllProducts();
    },

    async initialize() {
      this.loading = true;
      await this.refresh();
      this.loading = false;

      onStateChanged(async (message) => {
        if (message.type === "products-changed") {
          await this.refresh();
        }
      });
    },

    markDirty() {
      this.isDirty = true;
    },
  },
});
