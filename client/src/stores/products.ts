import { defineStore } from "pinia";
import { getAllProducts, refreshProductsFromServer } from "../db/productsRepo";
import type { ProductRecord } from "../db/schema";

export const useProductsStore = defineStore("products", {
  state: () => ({
    products: [] as ProductRecord[],
    loading: false,
    lastSyncSucceeded: null as boolean | null,
  }),
  actions: {
    async initialize() {
      this.loading = true;
      this.lastSyncSucceeded = await refreshProductsFromServer();
      this.products = await getAllProducts();
      this.loading = false;
    },
  },
});
