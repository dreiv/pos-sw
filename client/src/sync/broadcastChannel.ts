import { useBroadcastChannel } from "@vueuse/core";
import { watch } from "vue";

export type PosBroadcastMessage =
  | { type: "cart-changed" }
  | { type: "outbox-changed" }
  | { type: "connectivity-changed"; isOnline: boolean; isSyncing: boolean }
  | { type: "products-changed" };

const CHANNEL_NAME = "pos-state";

const { post, data } = useBroadcastChannel<PosBroadcastMessage, PosBroadcastMessage>({
  name: CHANNEL_NAME,
});

/**
 * Tell other tabs: "something changed, re-read it from IndexedDB /
 * re-check your state." We don't send the actual data — sending the
 * cart/outbox contents in the message would create two sources of
 * truth that can diverge (a dropped message, wrong ordering, a tab
 * that was on a different page). IndexedDB stays the single source of
 * truth; the broadcast is just a doorbell. Note: BroadcastChannel does
 * NOT deliver a message back to the tab that sent it (per spec), so
 * there's no need to filter yourself out.
 */
export function notifyStateChanged(message: PosBroadcastMessage): void {
  post(message);
}

export function onStateChanged(handler: (message: PosBroadcastMessage) => void): () => void {
  return watch(data, (message) => {
    if (message) handler(message);
  });
}
