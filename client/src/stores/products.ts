import { defineStore } from "pinia";
import {
  getAllProducts,
  refreshProductsFromServer,
} from "../db/productsRepo";
import type { ProductRecord } from "../db/schema";

export const useProductsStore = defineStore("products", {
  state: () => ({
    products: [] as ProductRecord[],
    loading: false,
    lastSyncSucceeded: null as boolean | null,
  }),
  actions: {
    // Called once on app boot: try the server first, then always read
    // back from IndexedDB regardless of whether that succeeded — this
    // way the UI's source of truth is always "what's in the DB right
    // now", not "what the last network call happened to return".
    async initialize() {
      this.loading = true;
      this.lastSyncSucceeded = await refreshProductsFromServer();
      this.products = await getAllProducts();
      this.loading = false;
    },
  },
});