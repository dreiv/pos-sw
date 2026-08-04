import { useBroadcastChannel } from "@vueuse/core";
import { watch } from "vue";

export type PosBroadcastMessage =
  | { type: "cart-changed" }
  | { type: "outbox-changed" }
  | { type: "products-changed" };

const CHANNEL_NAME = "pos-state";

const { post, data } = useBroadcastChannel<PosBroadcastMessage, PosBroadcastMessage>({
  name: CHANNEL_NAME,
});

// Doorbell pattern: tell other tabs something changed so they re-read
// from IndexedDB, rather than sending the data itself (which would
// create a second, divergence-prone source of truth). BroadcastChannel
// doesn't deliver back to the sending tab, so no need to filter self out.
export function notifyStateChanged(message: PosBroadcastMessage): void {
  post(message);
}

export function onStateChanged(handler: (message: PosBroadcastMessage) => void): () => void {
  return watch(data, (message) => {
    if (message) handler(message);
  });
}
