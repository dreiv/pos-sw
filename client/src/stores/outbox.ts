import { defineStore } from "pinia";
import { getAllOutbox, enqueueCheckout } from "../db/outboxRepo";
import { runSyncCycle, startSyncEngine } from "../sync/syncEngine";
import type { CartItemRecord, OutboxRecord } from "../db/schema";

export const useOutboxStore = defineStore("outbox", {
  state: () => ({
    items: [] as OutboxRecord[],
    stopEngine: null as (() => void) | null,
  }),
  actions: {
    async initialize() {
      this.items = await getAllOutbox();
      if (!this.stopEngine) {
        this.stopEngine = startSyncEngine();
      }
    },
    async checkout(cartItems: CartItemRecord[], total: number): Promise<string> {
      const id = crypto.randomUUID();
      // Written to IndexedDB before any network call — the customer's
      // transaction is durable the instant they confirm, online or not.
      await enqueueCheckout(id, cartItems, total);
      this.items = await getAllOutbox();
      // Try immediately so a checkout while online doesn't just sit
      // there until the next interval tick.
      await runSyncCycle();
      this.items = await getAllOutbox();
      return id;
    },
  },
});
