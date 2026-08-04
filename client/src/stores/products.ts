import { defineStore } from "pinia";
import { getAllProducts, refreshProductsFromServer } from "../db/productsRepo";
import { onStateChanged } from "../sync/broadcastChannel";
import type { ProductRecord } from "../db/schema";

export const useProductsStore = defineStore("products", {
  state: () => ({
    products: [] as ProductRecord[],
    loading: false,
    lastSyncSucceeded: null as boolean | null,
    isDirty: false,
  }),
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
