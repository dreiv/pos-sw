import { toRaw } from "vue";
import { defineStore } from "pinia";
import {
  getAllOutbox,
  enqueueCheckout,
  markSynced,
  markFailed,
  recordAttempt,
} from "../db/outboxRepo";
import { notifyStateChanged, onStateChanged } from "../sync/broadcastChannel";
import { API_BASE } from "../config";
import type { CartItemRecord, OutboxRecord } from "../db/schema";

const RECONCILE_LOCK_NAME = "outbox-reconcile-leader";

const RECONCILE_FAILURE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export const useOutboxStore = defineStore("outbox", {
  state: () => ({
    items: [] as OutboxRecord[],
    unsubscribeBroadcast: null as (() => void) | null,
    onlineHandler: null as (() => void) | null,
    visibilityHandler: null as (() => void) | null,
  }),
  actions: {
    async initialize() {
      this.items = await getAllOutbox();

      // One-shot resend for anything still "pending" — not a retry loop. It
      // only exists to catch anything left pending from a previous session;
      // the server dedupes by id, so a redundant resend is a safe no-op.
      // Leader-gated like every other trigger below, so several tabs
      // opening at once don't all fire it simultaneously either.
      await this.runReconciliation();

      if (!this.unsubscribeBroadcast) {
        this.unsubscribeBroadcast = onStateChanged((message) => {
          if (message.type === "outbox-changed") {
            getAllOutbox().then((items) => {
              this.items = items;
            });
          }
        });
      }

      if (!this.onlineHandler) {
        this.onlineHandler = () => {
          void this.runReconciliation();
        };
        window.addEventListener("online", this.onlineHandler);
      }

      if (!this.visibilityHandler) {
        this.visibilityHandler = () => {
          if (document.visibilityState === "visible") {
            void this.runReconciliation();
          }
        };
        document.addEventListener("visibilitychange", this.visibilityHandler);
      }
    },

    async runReconciliation() {
      if (!("locks" in navigator)) {
        await this.reconcilePending();
        return;
      }
      await navigator.locks.request(
        RECONCILE_LOCK_NAME,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock) return;
          await this.reconcilePending();
        },
      );
    },

    async reconcilePending() {
      const pending = this.items.filter((item) => item.status === "pending");
      if (pending.length === 0) return;

      let changed = false;
      for (const record of pending) {
        try {
          const res = await fetch(`${API_BASE}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: record.id, items: record.items, total: record.total }),
          });
          if (res.ok) {
            await markSynced(record.id);
            changed = true;
            continue;
          }
          await recordAttempt(record.id);
          changed = true;
        } catch {
          // Still unreachable — leave it pending for the next trigger.
          await recordAttempt(record.id);
          changed = true;
        }

        if (Date.now() - record.createdAt > RECONCILE_FAILURE_THRESHOLD_MS) {
          await markFailed(record.id);
          changed = true;
        }
      }

      if (changed) {
        this.items = await getAllOutbox();
        notifyStateChanged({ type: "outbox-changed" });
      }
    },

    async checkout(cartItems: CartItemRecord[], total: number): Promise<string> {
      const id = crypto.randomUUID();
      const record = await enqueueCheckout(id, toRaw(cartItems).map(toRaw), total);
      this.items = await getAllOutbox();
      notifyStateChanged({ type: "outbox-changed" });

      try {
        // The SW's POST /transactions route is a plain network passthrough
        // now; reconcilePending() above is what actually retries this
        // record, on every browser, via the next online/visibilitychange
        // trigger.
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
        // Left pending; the next online/visibilitychange trigger picks
        // it up via reconcilePending().
      }

      return id;
    },

    dispose() {
      if (this.onlineHandler) {
        window.removeEventListener("online", this.onlineHandler);
        this.onlineHandler = null;
      }
      if (this.visibilityHandler) {
        document.removeEventListener("visibilitychange", this.visibilityHandler);
        this.visibilityHandler = null;
      }
      if (this.unsubscribeBroadcast) {
        this.unsubscribeBroadcast();
        this.unsubscribeBroadcast = null;
      }
    },
  },
});
