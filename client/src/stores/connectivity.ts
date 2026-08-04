import { defineStore } from "pinia";
import { isOnline, probeOnce } from "../sync/connectivity";
import { useOutboxStore } from "./outbox";

export type ConnectivityStatus = "online" | "offline" | "syncing";

// "Syncing" is derived (online + pending outbox items) instead of a
// separate flag some other module has to remember to flip on/off.
export const useConnectivityStore = defineStore("connectivity", {
  getters: {
    status(): ConnectivityStatus {
      if (!isOnline.value) return "offline";
      const outboxStore = useOutboxStore();
      const hasPending = outboxStore.items.some((item) => item.status === "pending");
      return hasPending ? "syncing" : "online";
    },
  },
  actions: {
    initialize() {
      probeOnce();
    },
  },
});
