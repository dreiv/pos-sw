import { toRaw } from "vue";
import { defineStore } from "pinia";
import { getAllOutbox, enqueueCheckout, markSynced } from "../db/outboxRepo";
import { notifyStateChanged, onStateChanged } from "../sync/broadcastChannel";
import { API_BASE } from "../config";
import type { CartItemRecord, OutboxRecord } from "../db/schema";

// Posted by the Service Worker (src/sw/sw.ts) after its Background
// Sync queue successfully replays a queued /transactions request.
interface OutboxSyncedMessage {
  type: "OUTBOX_SYNCED";
  id: string;
}

function isOutboxSyncedMessage(data: unknown): data is OutboxSyncedMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "OUTBOX_SYNCED"
  );
}

export const useOutboxStore = defineStore("outbox", {
  state: () => ({
    items: [] as OutboxRecord[],
    unsubscribeBroadcast: null as (() => void) | null,
    swMessageHandler: null as ((event: MessageEvent) => void) | null,
  }),
  actions: {
    async initialize() {
      this.items = await getAllOutbox();

      // One-shot resend for anything still "pending" — not a retry
      // loop. It only exists to catch the case where the SW synced a
      // record while no tab was open to receive OUTBOX_SYNCED; the
      // server dedupes by id, so a redundant resend is a safe no-op.
      await this.reconcilePending();

      if (!this.swMessageHandler && "serviceWorker" in navigator) {
        this.swMessageHandler = (event: MessageEvent) => {
          if (isOutboxSyncedMessage(event.data)) {
            void this.handleSynced(event.data.id);
          }
        };
        navigator.serviceWorker.addEventListener("message", this.swMessageHandler);
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

    async reconcilePending() {
      const pending = this.items.filter((item) => item.status === "pending");
      for (const record of pending) {
        try {
          const res = await fetch(`${API_BASE}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: record.id, items: record.items, total: record.total }),
          });
          if (res.ok) await markSynced(record.id);
        } catch {
          // Still unreachable — leave it pending for Background Sync.
        }
      }
      if (pending.length > 0) {
        this.items = await getAllOutbox();
        notifyStateChanged({ type: "outbox-changed" });
      }
    },

    async handleSynced(id: string) {
      await markSynced(id);
      this.items = await getAllOutbox();
      notifyStateChanged({ type: "outbox-changed" });
    },

    async checkout(cartItems: CartItemRecord[], total: number): Promise<string> {
      const id = crypto.randomUUID();
      const record = await enqueueCheckout(id, toRaw(cartItems).map(toRaw), total);
      this.items = await getAllOutbox();
      notifyStateChanged({ type: "outbox-changed" });

      try {
        // Intercepted by the SW's POST /transactions route (sw.ts). On
        // failure, the Background Sync queue has already captured this
        // exact request before the promise rejects — nothing to retry here.
        const res = await fetch(`${API_BASE}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: record.id, items: record.items, total: record.total }),
        });
        if (res.ok) {
          await markSynced(id);
          this.items = await getAllOutbox();
          notifyStateChanged({ type: "outbox-changed" });
        }
      } catch {
        // Queued for Background Sync; the SW will message OUTBOX_SYNCED
        // once confirmed.
      }

      return id;
    },
  },
});
