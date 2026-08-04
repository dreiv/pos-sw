import { defineStore } from "pinia";
import { getStatus, subscribeConnectivity, type ConnectivityStatus } from "../sync/connectivity";

export const useConnectivityStore = defineStore("connectivity", {
  state: () => ({
    status: "online" as ConnectivityStatus,
    unsubscribe: null as (() => void) | null,
  }),
  actions: {
    initialize() {
      if (this.unsubscribe) return;
      this.status = getStatus();
      this.unsubscribe = subscribeConnectivity((s) => {
        this.status = s;
      });
    },
  },
});