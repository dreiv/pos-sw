import { toRaw } from "vue";
import { defineStore } from "pinia";
import { getAllOutbox, enqueueCheckout } from "../db/outboxRepo";
import { runSyncCycle, startSyncEngine } from "../sync/syncEngine";
import { notifyStateChanged, onStateChanged } from "../sync/broadcastChannel";
import type { CartItemRecord, OutboxRecord } from "../db/schema";

export const useOutboxStore = defineStore("outbox", {
  state: () => ({
    items: [] as OutboxRecord[],
    stopEngine: null as (() => void) | null,
    unsubscribeBroadcast: null as (() => void) | null,
  }),
  actions: {
    async initialize() {
      this.items = await getAllOutbox();

      if (!this.stopEngine) {
        this.stopEngine = startSyncEngine();
      }

      if (!this.unsubscribeBroadcast) {
        this.unsubscribeBroadcast = onStateChanged((message) => {
          if (message.type === "outbox-changed") {
            getAllOutbox().then((items) => {
              this.items = items;
            });
          }
        });
      }
    },
    async checkout(cartItems: CartItemRecord[], total: number): Promise<string> {
      const id = crypto.randomUUID();
      await enqueueCheckout(id, toRaw(cartItems).map(toRaw), total);
      this.items = await getAllOutbox();
      notifyStateChanged({ type: "outbox-changed" });

      // BroadcastChannel excludes the sending tab; re-fetch locally to reflect
      // status updates (e.g. pending -> synced) immediately.
      await runSyncCycle();
      this.items = await getAllOutbox();

      return id;
    },
  },
});
