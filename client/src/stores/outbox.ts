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

      // Fiecare tab apelează startSyncEngine — e ok acum, pentru că
      // leadership-ul e controlat de Navigator Locks în interior, nu de
      // noi aici. Un tab non-lider stă doar la coadă pe lock; nu rulează
      // niciun ciclu de sync până nu devine lider.
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
      await enqueueCheckout(id, cartItems, total);
      this.items = await getAllOutbox();
      notifyStateChanged({ type: "outbox-changed" });

      // Încercăm imediat, ca un checkout online să nu aștepte până la
      // următorul tick. Asta ocolește intenționat lock-ul de leadership —
      // dacă tabul curent nu e liderul, tot trimite direct. E sigur
      // pentru că trySend e idempotent (id-ul e cheia de idempotență):
      // în cel mai rău caz, liderul mai încearcă și el același record la
      // următorul tick, iar serverul recunoaște că l-a mai procesat și
      // răspunde cu 200 fără să dubleze tranzacția.
      await runSyncCycle();
      this.items = await getAllOutbox();
      return id;
    },
  },
});
