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

      // Every tab calls startSyncEngine — that's fine now, because
      // leadership is gated by Navigator Locks inside it, not by us.
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
      // Written to IndexedDB before any network call — the customer's
      // transaction is durable the instant they confirm, online or not.
      await enqueueCheckout(id, cartItems, total);
      this.items = await getAllOutbox();
      notifyStateChanged({ type: "outbox-changed" });

      // Try immediately so a checkout while online doesn't just sit
      // there until the next interval tick. This bypasses the
      // leadership lock on purpose — safe because trySend is
      // idempotent, so even if the leader tab's own loop also picks
      // this record up on its next tick, the server just replays the
      // same recorded result instead of double-charging.
      await runSyncCycle();
      this.items = await getAllOutbox();
      return id;
    },
  },
});
